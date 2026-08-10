import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from '../config.js';
import { decryptWithServerKey } from '../auth/crypto.js';
import { findUserById, listActiveBots, listBotsForUser, updateBot, insertBotTrade } from '../auth/store.js';
import { PumpDiscovery } from '../solana/pumpDiscovery.js';
import { solscanTxUrl } from '../solana/config.js';
import { selectToken, defaultTradingRules, normalizeRules } from './strategies.js';

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
    this.botStatus = new Map();
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
      return null;
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
    if (this.busy || config.simulationFallback) return;
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

  async runBot(bot) {
    const keypair = await this.getKeypair(bot.userId);
    if (!keypair) {
      this.botStatus.set(String(bot.id), { reason: 'wallet not synced for Solana trading', at: Date.now() });
      return;
    }

    const rules = normalizeRules(bot.tradingRules);
    const balance = await this.pump.connection.getBalance(keypair.publicKey);
    const balanceSol = balance / LAMPORTS_PER_SOL;
    const feeReserve = 0.004;

    if (bot.position?.mint) {
      const token = this.discovery.get(bot.position.mint);
      const currentMcap = token?.usdMarketCap ?? 0;
      const takeProfit = this.shouldTakeProfit(bot.position, currentMcap, rules);
      const stopLoss = this.shouldStopLoss(bot.position, currentMcap, rules);
      const stale = Date.now() - (bot.position.boughtAt ?? 0) > 30_000;

      if (takeProfit || stopLoss || stale) {
        const sellSol = Math.min(rules.buyAmountSol, balanceSol);
        if (balanceSol < feeReserve) {
          this.botStatus.set(String(bot.id), {
            reason: `cannot sell — need ~${feeReserve} SOL for fees, have ${balanceSol.toFixed(4)}`,
            at: Date.now(),
          });
          return;
        }

        let result;
        try {
          result = await this.pump.sellToken({
            keypair,
            mintAddress: bot.position.mint,
            targetSol: sellSol,
          });
        } catch (err) {
          this.botStatus.set(String(bot.id), {
            reason: `sell failed: ${String(err.message).slice(0, 140)}`,
            at: Date.now(),
          });
          console.error(`[user-bots] ${bot.name || bot.botType} sell error:`, err.message);
          return;
        }

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
        }
      } else {
        const pnl = bot.position.entryMcap && currentMcap
          ? (((currentMcap - bot.position.entryMcap) / bot.position.entryMcap) * 100).toFixed(2)
          : '—';
        this.botStatus.set(String(bot.id), {
          reason: `holding $${bot.position.symbol} (${pnl}%) — waiting for TP/SL`,
          at: Date.now(),
        });
      }
      return;
    }

    if (balanceSol < rules.buyAmountSol + feeReserve) {
      this.botStatus.set(String(bot.id), {
        reason: `need more SOL — have ${balanceSol.toFixed(4)} SOL`,
        at: Date.now(),
      });
      return;
    }

    const candidates = this.filterCandidates(rules);
    const target = selectToken(bot.botType, candidates);
    if (!target) {
      this.botStatus.set(String(bot.id), {
        reason: `no Pump.fun tokens in market-cap range (${this.discovery.list().length} scanned)`,
        at: Date.now(),
      });
      return;
    }

    let result;
    try {
      result = await this.pump.buyToken({
        keypair,
        mintAddress: target.mint,
        solAmount: rules.buyAmountSol,
      });
    } catch (err) {
      this.botStatus.set(String(bot.id), {
        reason: `buy failed on $${target.symbol}: ${String(err.message).slice(0, 140)}`,
        at: Date.now(),
      });
      console.error(`[user-bots] ${bot.name || bot.botType} buy error on $${target.symbol}:`, err.message);
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
    const active = bots.filter((bot) => bot.isActive);
    const rules = normalizeRules(active[0]?.tradingRules ?? defaultTradingRules());
    const pool = this.discovery.list();
    const candidates = this.filterCandidates(rules);
    return {
      engineRunning: true,
      chain: 'Solana',
      network: config.solanaNetwork,
      simulationFallback: config.simulationFallback,
      authConfigured: Boolean(config.authServerKey),
      discoveryPool: pool.length,
      candidatesInRange: candidates.length,
      pumpDiscovery: {
        poolSize: pool.length,
        tradableCount: candidates.length,
        lastRefresh: this.discovery.lastRefresh,
      },
      mcapRange: { min: rules.minMarketCap, max: rules.maxMarketCap },
      activeBots: active.length,
      botStatus: active.map((bot) => ({
        id: bot.id,
        name: bot.name || bot.botType,
        isActive: bot.isActive,
        position: bot.position,
        lastStatus: this.botStatus.get(String(bot.id)) ?? null,
      })),
    };
  }
}
