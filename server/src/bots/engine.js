import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from '../config.js';
import { decryptWithServerKey } from '../auth/crypto.js';
import { findUserById, listActiveBots, listBotsForUser, updateBot, insertBotTrade } from '../auth/store.js';
import { PumpDiscovery } from '../solana/pumpDiscovery.js';
import { solscanTxUrl } from '../solana/config.js';
import { selectToken, normalizeRules, defaultTradingRules } from './strategies.js';

export class UserBotEngine {
  /**
   * @param {import('../solana/pump.js').PumpService} pump
   */
  constructor(pump) {
    this.pump = pump;
    this.discovery = new PumpDiscovery();
    this.busy = false;
    this.timers = [];
    this.keypairCache = new Map();
    /** @type {Map<string, number>} */
    this.skipLogAt = new Map();
    /** @type {Map<string, { reason: string, at: number }>} */
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
    this.timers.push(setInterval(() => this.discovery.refresh(), 60_000));
    this.timers.push(setInterval(() => this.tick(), 3_000));
    console.log('[user-bots] Engine started — 3s tick');
    setTimeout(() => this.tick(), 2_000);
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  async getKeypair(userId) {
    if (this.keypairCache.has(userId)) return this.keypairCache.get(userId);
    const user = await findUserById(userId);
    if (!user?.serverEncryptedKey) return null;
    try {
      const secret = decryptWithServerKey(user.serverEncryptedKey, config.authServerKey);
      const kp = Keypair.fromSecretKey(bs58.decode(secret));
      this.keypairCache.set(userId, kp);
      return kp;
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

      await Promise.all(bots.map((bot) => this.runBot(bot).catch((err) => {
        console.error(`[user-bots] bot ${bot.id} error:`, err.message);
      })));
    } finally {
      this.busy = false;
    }
  }

  async clearGhostPosition(bot, keypair) {
    if (!bot.position?.mint) return false;
    const held = await this.pump.getTokenBalanceRaw(keypair, bot.position.mint);
    if (held > 0n) return false;
    await updateBot(bot.id, bot.userId, { position: null });
    console.log(`[user-bots] ${bot.name || bot.botType} cleared stale position (no on-chain balance)`);
    bot.position = null;
    return true;
  }

  async runBot(bot) {
    const keypairResult = await this.getKeypair(bot.userId);
    if (!keypairResult) {
      this.setStatus(bot, 'wallet not synced — use Sync wallet on dashboard');
      return;
    }
    if (keypairResult.decryptFailed) {
      this.setStatus(bot, 'AUTH_SERVER_KEY mismatch — log out, log in again to re-sync');
      return;
    }
    const keypair = keypairResult;

    const rules = normalizeRules(bot.tradingRules);
    const balance = await this.pump.connection.getBalance(keypair.publicKey);
    const balanceSol = balance / LAMPORTS_PER_SOL;
    const feeReserve = 0.004;

    if (bot.position?.mint) {
      await this.clearGhostPosition(bot, keypair);

      const token = this.discovery.get(bot.position.mint);
      const currentMcap = token?.usdMarketCap ?? 0;
      const takeProfit = this.shouldTakeProfit(bot.position, currentMcap, rules);
      const stopLoss = this.shouldStopLoss(bot.position, currentMcap, rules);
      const stale = Date.now() - (bot.position.boughtAt ?? 0) > 30_000;

      if (!takeProfit && !stopLoss && !stale) {
        this.setStatus(bot, `holding $${bot.position.symbol} — waiting for TP/SL or 30s`);
        return;
      }

      if (takeProfit || stopLoss || stale) {
        const sellSol = Math.min(rules.buyAmountSol, balanceSol);
        if (balanceSol < feeReserve) {
          this.setStatus(bot, `balance too low to sell (${balanceSol.toFixed(4)} SOL)`);
          return;
        }

        const result = await this.pump.sellToken({
          keypair,
          mintAddress: bot.position.mint,
          targetSol: sellSol,
        });

        if (result) {
          await insertBotTrade({
            botId: bot.id,
            userId: bot.userId,
            side: 'sell',
            mint: bot.position.mint,
            symbol: bot.position.symbol,
            solAmount: result.solAmount,
            signature: result.signature,
            explorerUrl: solscanTxUrl(result.signature),
          });
          await updateBot(bot.id, bot.userId, { position: null });
          console.log(`[user-bots] ${bot.name || bot.botType} sold $${bot.position.symbol} (${takeProfit ? 'TP' : stopLoss ? 'SL' : 'time'})`);
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

    const minRequired = rules.buyAmountSol + feeReserve;
    if (balanceSol < minRequired) {
      this.setStatus(bot, `need ${minRequired.toFixed(4)} SOL, have ${balanceSol.toFixed(4)}`);
      return;
    }

    const candidates = this.filterCandidates(rules);
    if (!candidates.length) {
      const pool = this.discovery.list().length;
      this.setStatus(bot, `no tokens in $${rules.minMarketCap}-$${rules.maxMarketCap} mcap (${pool} discovered)`);
      return;
    }

    const target = selectToken(bot.botType, candidates);
    if (!target) return;

    let result;
    try {
      result = await this.pump.buyToken({
        keypair,
        mintAddress: target.mint,
        solAmount: rules.buyAmountSol,
      });
    } catch (err) {
      console.error(`[user-bots] ${bot.name || bot.botType} buy failed on $${target.symbol}:`, err.message);
      this.setStatus(bot, `buy failed: ${err.message.slice(0, 120)}`);
      return;
    }

    if (result) {
      await insertBotTrade({
        botId: bot.id,
        userId: bot.userId,
        side: 'buy',
        mint: target.mint,
        symbol: target.symbol,
        solAmount: result.solAmount,
        signature: result.signature,
        explorerUrl: solscanTxUrl(result.signature),
      });
      await updateBot(bot.id, bot.userId, {
        position: {
          mint: target.mint,
          symbol: target.symbol,
          entryMcap: target.usdMarketCap,
          entrySol: result.solAmount,
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
    return {
      engineRunning: true,
      simulationFallback: config.simulationFallback,
      authConfigured: Boolean(config.authServerKey),
      discoveryPool: pool.length,
      candidatesInRange: candidates.length,
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
