import { config } from '../config.js';
import { decryptWithServerKey } from '../auth/crypto.js';
import { findUserById, listActiveBots, listBotsForUser, updateBot, insertBotTrade } from '../auth/store.js';
import { StockDiscovery } from '../evm/stockDiscovery.js';
import { txExplorerUrl } from '../chain/ethereum.js';
import { buildTradeCandidateOrder, normalizeRules, defaultTradingRules } from './strategies.js';

export class UserBotEngine {
  /**
   * @param {import('../evm/tradingService.js').TradingService} trading
   */
  constructor(trading) {
    this.trading = trading;
    this.discovery = new StockDiscovery();
    this.busy = false;
    this.timers = [];
    this.walletCache = new Map();
    this.skipLogAt = new Map();
    this.botStatus = new Map();
    this.sellFailCounts = new Map();
    this.simulationLogged = false;
  }

  setStatus(bot, reason) {
    this.botStatus.set(String(bot.id), { reason, at: Date.now() });
    this.logSkip(bot, reason);
  }

  getStatus(botId) {
    return this.botStatus.get(String(botId)) ?? null;
  }

  getAllStatus() {
    return Object.fromEntries(this.botStatus);
  }

  logSkip(bot, reason) {
    const now = Date.now();
    const last = this.skipLogAt.get(bot.id) ?? 0;
    if (now - last < 60_000) return;
    this.skipLogAt.set(bot.id, now);
    console.log(`[user-bots] ${bot.name || bot.botType} (${bot.id}) skip: ${reason}`);
  }

  /** Spend up to rule cap, but only what fits in wallet after gas reserve. */
  buyEthForBalance(balanceEth, rules) {
    const available = balanceEth - config.botGasReserveEth;
    if (available <= 0) return 0;
    return Math.min(rules.buyAmountEth, available);
  }

  gasNeededStatus(balanceEth, sym) {
    return `need more ETH for gas on Ethereum mainnet — have ${balanceEth.toFixed(6)} ${sym}`;
  }

  start() {
    this.discovery.refresh();
    this.timers.push(setInterval(() => this.discovery.refresh(), config.stockDiscoveryRefreshMs));
    this.timers.push(setInterval(() => this.tick(), 5_000));
    console.log('[user-bots] Engine started — Ethereum tokenized stocks via Uniswap V3, 5s tick');
    setTimeout(() => this.tick(), 2_000);
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  async getWallet(userId) {
    if (this.walletCache.has(userId)) return this.walletCache.get(userId);
    const user = await findUserById(userId);
    if (!user?.serverEncryptedKey) return null;
    try {
      const secret = decryptWithServerKey(user.serverEncryptedKey, config.authServerKey);
      const wallet = this.trading.walletFromPrivateKey(secret);
      this.walletCache.set(userId, wallet);
      return wallet;
    } catch (err) {
      console.error(`[user-bots] wallet decrypt failed for ${userId}:`, err.message);
      return { decryptFailed: true };
    }
  }

  /** Tradable stock tokens whose on-chain market cap fits the bot's band. */
  filterCandidates(rules) {
    return this.discovery.list().filter(
      (t) => t.tradable
        && t.usdMarketCap >= rules.minMarketCap
        && t.usdMarketCap <= rules.maxMarketCap,
    );
  }

  positionEntryPrice(position) {
    return Number(position?.entryPrice) || 0;
  }

  shouldTakeProfit(position, currentPrice, rules) {
    const entry = this.positionEntryPrice(position);
    if (!entry || !currentPrice) return false;
    const pct = ((currentPrice - entry) / entry) * 100;
    return pct >= rules.takeProfitPercent;
  }

  shouldStopLoss(position, currentPrice, rules) {
    const entry = this.positionEntryPrice(position);
    if (!entry || !currentPrice) return false;
    const pct = ((entry - currentPrice) / entry) * 100;
    return pct >= rules.stopLossPercent;
  }

  async tick() {
    if (this.busy) return;
    if (config.simulationFallback) {
      if (!this.simulationLogged) {
        console.log('[user-bots] SIMULATION_FALLBACK=true — user bots disabled');
        this.simulationLogged = true;
      }
      return;
    }
    this.busy = true;
    try {
      const bots = await listActiveBots();
      if (!bots.length) return;

      if (!this.discovery.list().length) await this.discovery.refresh();

      // One wallet per user — run bots sequentially per user to avoid nonce collisions.
      const byUser = new Map();
      for (const bot of bots) {
        if (!byUser.has(bot.userId)) byUser.set(bot.userId, []);
        byUser.get(bot.userId).push(bot);
      }

      await Promise.all([...byUser.entries()].map(([, userBots]) =>
        (async () => {
          for (const bot of userBots) {
            await this.runBot(bot).catch((err) => {
              console.error(`[user-bots] bot ${bot.id} error:`, err.message);
            });
          }
        })(),
      ));
    } finally {
      this.busy = false;
    }
  }

  async clearGhostPosition(bot, wallet) {
    const tokenAddr = bot.position?.mint || bot.position?.address;
    if (!tokenAddr) return false;
    const held = await this.trading.getTokenBalanceRaw(wallet, tokenAddr);
    if (held > 0n) return false;
    await updateBot(bot.id, bot.userId, { position: null });
    console.log(`[user-bots] ${bot.name || bot.botType} cleared stale position (no on-chain balance)`);
    bot.position = null;
    return true;
  }

  async runBot(bot) {
    const walletResult = await this.getWallet(bot.userId);
    if (!walletResult) {
      this.setStatus(bot, 'wallet not synced — use Sync wallet on dashboard');
      return;
    }
    if (walletResult.decryptFailed) {
      this.setStatus(bot, 'AUTH_SERVER_KEY mismatch — log out, log in again to re-sync');
      return;
    }
    const wallet = walletResult;

    const rules = normalizeRules(bot.tradingRules);
    const balanceEth = await this.trading.getBalanceEth(wallet.address);
    const feeReserve = config.botGasReserveEth;
    const sym = config.nativeSymbol;

    const tokenAddr = bot.position?.mint || bot.position?.address;
    if (tokenAddr) {
      await this.clearGhostPosition(bot, wallet);
      if (!bot.position) return;

      const token = this.discovery.get(tokenAddr);
      const currentPrice = token?.priceUsd ?? 0;
      const takeProfit = this.shouldTakeProfit(bot.position, currentPrice, rules);
      const stopLoss = this.shouldStopLoss(bot.position, currentPrice, rules);
      const maxHoldMs = config.botMaxHoldMs;
      const stale = Date.now() - (bot.position.boughtAt ?? 0) > maxHoldMs;

      if (!takeProfit && !stopLoss && !stale) {
        const entry = this.positionEntryPrice(bot.position);
        const pnl = entry && currentPrice ? (((currentPrice - entry) / entry) * 100).toFixed(2) : '—';
        this.setStatus(bot, `holding ${bot.position.symbol} stock @ $${currentPrice || '—'} (${pnl}%) — waiting for TP/SL`);
        return;
      }

      if (balanceEth < feeReserve) {
        this.setStatus(bot, this.gasNeededStatus(balanceEth, sym));
        return;
      }

      const result = await this.trading.sellToken({
        wallet,
        mintAddress: tokenAddr,
        pools: this.discovery.poolsFor(tokenAddr),
      });

      if (result) {
        await insertBotTrade({
          botId: bot.id,
          userId: bot.userId,
          side: 'sell',
          mint: tokenAddr,
          symbol: bot.position.symbol,
          solAmount: result.ethAmount,
          signature: result.signature,
          explorerUrl: result.explorerUrl || txExplorerUrl(config.chainExplorerUrl, result.signature),
        });
        await updateBot(bot.id, bot.userId, { position: null });
        console.log(`[user-bots] ${bot.name || bot.botType} sold ${bot.position.symbol} (${takeProfit ? 'TP' : stopLoss ? 'SL' : 'time'})`);
        this.botStatus.delete(String(bot.id));
        this.sellFailCounts.delete(bot.id);
      } else {
        const fails = (this.sellFailCounts.get(bot.id) ?? 0) + 1;
        this.sellFailCounts.set(bot.id, fails);
        if (fails >= 3) {
          await updateBot(bot.id, bot.userId, { position: null });
          bot.position = null;
          this.sellFailCounts.delete(bot.id);
          this.setStatus(bot, 'cleared stuck position after sell failures — will buy again');
        } else {
          this.setStatus(bot, `sell failed (${fails}/3) — retrying`);
        }
      }
      return;
    }

    const buyEth = this.buyEthForBalance(balanceEth, rules);
    if (buyEth <= 0) {
      this.setStatus(bot, this.gasNeededStatus(balanceEth, sym));
      return;
    }

    const candidates = this.filterCandidates(rules);
    if (!candidates.length) {
      const pool = this.discovery.list().length;
      this.setStatus(bot, `no tradable Ethereum stock tokens in your mcap band (${pool} listed) — widen the range`);
      return;
    }

    const ordered = buildTradeCandidateOrder(bot.botType, candidates);
    let target = null;
    let result;

    for (const candidate of ordered.slice(0, 20)) {
      try {
        const pools = this.discovery.poolsFor(candidate.address);
        const minOut = this.discovery.minOutForBuy(candidate.address, buyEth);
        const routable = await this.trading.canSwapEthForToken(candidate.address, buyEth, pools, minOut);
        if (!routable) continue;
        target = candidate;
        result = await this.trading.buyToken({
          wallet,
          mintAddress: candidate.address,
          ethAmount: buyEth,
          pools,
          minOut,
        });
        break;
      } catch (err) {
        const msg = this.trading.formatTxError?.(err) ?? err.message;
        console.error(`[user-bots] ${bot.name || bot.botType} buy failed on ${candidate.symbol}:`, msg);
        this.setStatus(bot, `buy failed on ${candidate.symbol}: ${msg.slice(0, 120)}`);
        return;
      }
    }

    if (!target) {
      this.setStatus(bot, `0/${candidates.length} stock tokens with live Uniswap V3 liquidity — retrying`);
      return;
    }

    if (result) {
      await insertBotTrade({
        botId: bot.id,
        userId: bot.userId,
        side: 'buy',
        mint: target.address,
        symbol: target.symbol,
        solAmount: result.ethAmount,
        signature: result.signature,
        explorerUrl: result.explorerUrl || txExplorerUrl(config.chainExplorerUrl, result.signature),
      });
      await updateBot(bot.id, bot.userId, {
        position: {
          mint: target.address,
          address: target.address,
          symbol: target.symbol,
          entryPrice: target.priceUsd,
          entryMcap: target.usdMarketCap,
          entryEth: result.ethAmount,
          entrySol: result.ethAmount,
          boughtAt: Date.now(),
        },
      });
      console.log(`[user-bots] ${bot.name || bot.botType} bought ${target.symbol} stock @ $${target.priceUsd}`);
      this.botStatus.delete(String(bot.id));
    }
  }

  async getDiagnostics(userId) {
    const bots = await listBotsForUser(userId);
    const active = bots.filter((b) => b.isActive);
    const pool = this.discovery.list();
    const rules = normalizeRules(active[0]?.tradingRules ?? defaultTradingRules());
    const candidates = this.filterCandidates(rules);
    let routableInRange = 0;
    for (const t of candidates.slice(0, 15)) {
      const pools = this.discovery.poolsFor(t.address);
      const minOut = this.discovery.minOutForBuy(t.address, rules.buyAmountEth);
      if (await this.trading.canSwapEthForToken(t.address, rules.buyAmountEth, pools, minOut)) {
        routableInRange += 1;
      }
    }
    return {
      engineRunning: true,
      chain: config.chainName,
      chainId: config.chainId,
      simulationFallback: config.simulationFallback,
      authConfigured: Boolean(config.authServerKey),
      discoveryPool: pool.length,
      candidatesInRange: candidates.length,
      routableInRange,
      stockDiscovery: this.discovery.getMeta(),
      mcapRange: { min: rules.minMarketCap, max: rules.maxMarketCap },
      activeBots: active.length,
      botStatus: active.map((b) => ({
        id: b.id,
        name: b.name || b.botType,
        isActive: b.isActive,
        position: b.position,
        lastStatus: this.getStatus(b.id),
      })),
    };
  }
}
