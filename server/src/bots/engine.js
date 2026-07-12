import { config } from '../config.js';
import { decryptWithServerKey } from '../auth/crypto.js';
import { findUserById, listActiveBots, listBotsForUser, updateBot, insertBotTrade } from '../auth/store.js';
import { MemecoinDiscovery } from '../evm/memecoinDiscovery.js';
import { txExplorerUrl } from '../chain/robinhood.js';
import { rankCandidates, normalizeRules, defaultTradingRules } from './strategies.js';

export class UserBotEngine {
  /**
   * @param {import('../evm/tradingService.js').TradingService} trading
   */
  constructor(trading) {
    this.trading = trading;
    this.discovery = new MemecoinDiscovery();
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

  start() {
    this.discovery.refresh();
    this.timers.push(setInterval(() => this.discovery.refresh(), config.memecoinDiscoveryRefreshMs));
    this.timers.push(setInterval(() => this.tick(), 3_000));
    console.log('[user-bots] Engine started — Ape.Store + NOXA launchpad memecoins, 3s tick');
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

  filterCandidates(rules) {
    return this.discovery.list().filter(
      (t) => t.usdMarketCap >= rules.minMarketCap && t.usdMarketCap <= rules.maxMarketCap,
    );
  }

  shouldTakeProfit(position, currentMcap, rules) {
    if (!position?.entryMcap || !currentMcap) return false;
    const pct = ((currentMcap - position.entryMcap) / position.entryMcap) * 100;
    return pct >= rules.takeProfitPercent;
  }

  shouldStopLoss(position, currentMcap, rules) {
    if (!position?.entryMcap || !currentMcap) return false;
    const pct = ((position.entryMcap - currentMcap) / position.entryMcap) * 100;
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
    const feeReserve = 0.001;
    const sym = config.nativeSymbol;

    const tokenAddr = bot.position?.mint || bot.position?.address;
    if (tokenAddr) {
      await this.clearGhostPosition(bot, wallet);

      const token = this.discovery.get(tokenAddr);
      const currentMcap = token?.usdMarketCap ?? 0;
      const takeProfit = this.shouldTakeProfit(bot.position, currentMcap, rules);
      const stopLoss = this.shouldStopLoss(bot.position, currentMcap, rules);
      const stale = Date.now() - (bot.position.boughtAt ?? 0) > 30_000;

      if (!takeProfit && !stopLoss && !stale) {
        this.setStatus(bot, `holding ${bot.position.symbol} — waiting for TP/SL or 30s`);
        return;
      }

      if (takeProfit || stopLoss || stale) {
        const sellEth = Math.min(rules.buyAmountEth, balanceEth);
        if (balanceEth < feeReserve) {
          this.setStatus(bot, `balance too low to sell (${balanceEth.toFixed(6)} ${sym})`);
          return;
        }

        const result = await this.trading.sellToken({
          wallet,
          mintAddress: tokenAddr,
          targetEth: sellEth,
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
      }
      return;
    }

    const minRequired = rules.buyAmountEth + feeReserve;
    if (balanceEth < minRequired) {
      this.setStatus(bot, `need ${minRequired.toFixed(6)} ${sym}, have ${balanceEth.toFixed(6)}`);
      return;
    }

    const candidates = this.filterCandidates(rules);
    if (!candidates.length) {
      const pool = this.discovery.list().length;
      const hint = rules.minMarketCap > 2_000
        ? ' — try lowering min market cap (~$1.6k for fresh launchpad tokens)'
        : '';
      this.setStatus(bot, `no launchpad memecoins in $${rules.minMarketCap}-$${rules.maxMarketCap} mcap (${pool} listed)${hint}`);
      return;
    }

    const ranked = rankCandidates(bot.botType, candidates);
    let target = null;
    let result;

    for (const candidate of ranked.slice(0, 15)) {
      try {
        const routable = await this.trading.canSwapEthForToken(candidate.address, rules.buyAmountEth);
        if (!routable) continue;
        target = candidate;
        result = await this.trading.buyToken({
          wallet,
          mintAddress: candidate.address,
          ethAmount: rules.buyAmountEth,
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
      this.setStatus(bot, `0/${candidates.length} launchpad tokens swappable on Uniswap V3 in your mcap range — waiting for pools`);
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
          entryMcap: target.usdMarketCap,
          entryEth: result.ethAmount,
          entrySol: result.ethAmount,
          boughtAt: Date.now(),
        },
      });
      console.log(`[user-bots] ${bot.name || bot.botType} bought $${target.symbol} (~$${Math.round(target.usdMarketCap)} mcap)`);
      this.botStatus.delete(String(bot.id));
    }
  }

  async getDiagnostics(userId) {
    const bots = await listBotsForUser(userId);
    const active = bots.filter((b) => b.isActive);
    const pool = this.discovery.list();
    const rules = normalizeRules(active[0]?.tradingRules ?? defaultTradingRules());
    const candidates = pool.filter(
      (t) => t.usdMarketCap >= rules.minMarketCap && t.usdMarketCap <= rules.maxMarketCap,
    );
    let routableInRange = 0;
    for (const t of candidates.slice(0, 25)) {
      if (await this.trading.canSwapEthForToken(t.address, rules.buyAmountEth)) routableInRange += 1;
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
      memecoinDiscovery: this.discovery.getMeta(),
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
