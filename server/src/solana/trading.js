import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAST_POOL } from '../engine/cast.js';
import { solanaConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', '..', 'data', 'trading-state.json');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      const validIds = new Set(CAST_POOL.map((c) => c.name.toLowerCase()));
      state.islandTokens = Object.fromEntries(
        Object.entries(state.islandTokens ?? {}).filter(([id]) => validIds.has(id)),
      );
      state.agentPanels = Object.fromEntries(
        Object.entries(state.agentPanels ?? {}).filter(([id]) => validIds.has(id)),
      );
      state.tradesByAgent = Object.fromEntries(
        Object.entries(state.tradesByAgent ?? {}).filter(([id]) => validIds.has(id)),
      );
      if (!state.tradesByAgent || Object.keys(state.tradesByAgent).length === 0) {
        state.tradesByAgent = {};
        for (const [id, panel] of Object.entries(state.agentPanels ?? {})) {
          if (panel.recentTrades?.length) state.tradesByAgent[id] = [...panel.recentTrades];
        }
      }
      return state;
    }
  } catch { /* ignore */ }
  return { islandTokens: {}, recentTrades: [], txLog: [], agentPanels: {}, tradesByAgent: {} };
}

function saveState(state) {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export class TradingEngine {
  /**
   * @param {object} opts
   * @param {import('./wallets.js').WalletManager} opts.wallets
   * @param {import('./pump.js').PumpService} opts.pump
   * @param {import('../engine/world.js').WorldEngine} opts.world
   * @param {(event: string, payload: any) => void} opts.dispatch
   */
  constructor({ wallets, pump, world, dispatch }) {
    this.wallets = wallets;
    this.pump = pump;
    this.world = world;
    this.dispatch = dispatch;
    this.state = loadState();
    this.tradeTimestamps = new Map();
    this.busy = false;
    this.timers = [];
    this.holdings = new Map();
  }

  start() {
    this.timers.push(setInterval(() => this.refreshBalances(), solanaConfig.balanceRefreshMs));
    this.timers.push(setInterval(() => this.tradingTick(), solanaConfig.tradeIntervalMs));
    this.timers.push(setInterval(() => this.marketCatalyst(), 120_000));
    this.refreshBalances();
    console.log(`[trading] Real on-chain mode — network=${solanaConfig.network}, fallback=${solanaConfig.simulationFallback}`);
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  async refreshBalances() {
    await this.wallets.refreshBalances();
    this.dispatch('market:update', this.getMarketState());
  }

  getMarketState() {
    return {
      mode: solanaConfig.simulationFallback ? 'simulation_fallback' : 'real',
      network: solanaConfig.network,
      disclaimer: 'REAL TRADING — user-funded agent wallets. Not financial advice.',
      minSolRecommended: solanaConfig.minSolForTrade,
      islandTokens: { ...this.state.islandTokens },
      recentTrades: this.state.recentTrades.slice(-40),
      wallets: this.wallets.allPublicWallets(),
      agentPanels: this.getAgentPanels(),
      tradesByAgent: this.getTradesByAgent(),
    };
  }

  getTradesByAgent() {
    const out = {};
    for (const template of CAST_POOL) {
      const id = template.name.toLowerCase();
      out[id] = this.getTradesForAgent(id);
    }
    return out;
  }

  getTradesForAgent(agentId) {
    const trades = this.state.tradesByAgent?.[agentId]
      ?? this.state.agentPanels?.[agentId]?.recentTrades
      ?? [];
    return [...trades].reverse();
  }

  getAgentPanels() {
    if (!this.state.agentPanels) this.state.agentPanels = {};
    return CAST_POOL.map((template) => {
      const id = template.name.toLowerCase();
      const agent = this.world.agent(id);
      const wallet = this.wallets.getPublicWallet(id);
      const panel = this.state.agentPanels[id] ?? {
        holdings: [], recentTrades: [], pnlSol: 0, totalBought: 0, totalSold: 0,
      };
      const islandMint = this.state.islandTokens[id];
      const netPnl = (panel.totalSold ?? 0) - (panel.totalBought ?? 0);
      const allTrades = this.getTradesForAgent(id);
      return {
        id,
        name: template.name,
        tagline: template.tagline,
        modelLabel: template.modelLabel,
        color: agent?.color ?? template.color,
        wallet,
        islandToken: islandMint
          ? { mint: islandMint, symbol: this.pump.tokenSymbol(template.name) }
          : null,
        holdings: panel.holdings ?? [],
        trades: allTrades,
        recentTrades: allTrades.slice(0, 50),
        pnlSol: Number(netPnl.toFixed(4)),
        positionStatus: (panel.holdings?.length ?? 0) > 0
          ? 'in_position'
          : wallet.funded ? 'ready' : 'unfunded',
      };
    });
  }

  symbolForMint(mint) {
    for (const [agentId, m] of Object.entries(this.state.islandTokens)) {
      if (m === mint) {
        const agent = this.world.agent(agentId);
        return agent ? `$${this.pump.tokenSymbol(agent.name)}` : mint.slice(0, 6);
      }
    }
    return mint.slice(0, 6);
  }

  recordAgentPanel(agentId, trade) {
    if (!this.state.agentPanels) this.state.agentPanels = {};
    if (!this.state.agentPanels[agentId]) {
      this.state.agentPanels[agentId] = {
        holdings: [], recentTrades: [], pnlSol: 0, totalBought: 0, totalSold: 0,
      };
    }
    const panel = this.state.agentPanels[agentId];
    panel.recentTrades.push(trade);
    if (panel.recentTrades.length > 100) {
      panel.recentTrades.splice(0, panel.recentTrades.length - 100);
    }

    if (!this.state.tradesByAgent) this.state.tradesByAgent = {};
    if (!this.state.tradesByAgent[agentId]) this.state.tradesByAgent[agentId] = [];
    this.state.tradesByAgent[agentId].push(trade);
    if (this.state.tradesByAgent[agentId].length > 500) {
      this.state.tradesByAgent[agentId].splice(0, this.state.tradesByAgent[agentId].length - 500);
    }

    const sol = Number(trade.solAmount) || 0;
    if (trade.side === 'buy') {
      panel.totalBought += sol;
      const sym = this.symbolForMint(trade.mint);
      let h = panel.holdings.find((x) => x.mint === trade.mint);
      if (h) h.costSol = (h.costSol ?? 0) + sol;
      else panel.holdings.push({ mint: trade.mint, symbol: sym, costSol: sol });
    } else if (trade.side === 'sell') {
      panel.totalSold += sol;
      const h = panel.holdings.find((x) => x.mint === trade.mint);
      if (h) {
        h.costSol = Math.max(0, (h.costSol ?? 0) * 0.4);
        if (h.costSol < 0.001) {
          panel.holdings = panel.holdings.filter((x) => x.mint !== trade.mint);
        }
      }
    } else if (trade.side === 'launch') {
      panel.totalBought += sol;
      panel.holdings.push({
        mint: trade.mint,
        symbol: trade.symbol ? `$${trade.symbol}` : this.symbolForMint(trade.mint),
        costSol: sol,
        own: true,
      });
    }
    panel.pnlSol = panel.totalSold - panel.totalBought;
    saveState(this.state);
  }

  enrichAgent(agent) {
    const panels = this.getAgentPanels();
    const panel = panels.find((p) => p.id === agent.id);
    return { ...agent, ...panel };
  }

  canTrade(agentId) {
    const now = Date.now();
    const window = this.tradeTimestamps.get(agentId) ?? [];
    const recent = window.filter((t) => now - t < 60_000);
    this.tradeTimestamps.set(agentId, recent);
    return recent.length < solanaConfig.maxTradesPerMinute;
  }

  recordTrade(agentId) {
    const window = this.tradeTimestamps.get(agentId) ?? [];
    window.push(Date.now());
    this.tradeTimestamps.set(agentId, window);
  }

  tradeableMints(excludeAgentId) {
    const mints = Object.entries(this.state.islandTokens)
      .filter(([id, mint]) => id !== excludeAgentId && mint)
      .map(([id, mint]) => ({ agentId: id, mint }));
    for (const mint of solanaConfig.extraMints) {
      if (!mints.find((m) => m.mint === mint)) mints.push({ agentId: 'external', mint });
    }
    return mints;
  }

  async tradingTick() {
    if (this.busy || solanaConfig.simulationFallback) return;
    const active = this.world.activeAgents();
    if (!active.length) return;

    const agent = pick(active.filter((a) => this.canTrade(a.id)) || active);
    if (!agent) return;

    this.busy = true;
    try {
      await this.wallets.refreshBalances();

      if (!this.wallets.hasFunds(agent.id)) {
        this.emitBroke(agent);
        return;
      }

      const balance = this.wallets.getBalance(agent.id);
      const p = agent.personality;
      const tradeChance = 0.15 + p.chaos * 0.35 + p.aggression * 0.2;

      if (!chance(tradeChance)) return;

      const keypair = this.wallets.getKeypair(agent.id);
      if (!keypair) return;

      // Launch island token if not yet launched and wallet has enough
      if (!this.state.islandTokens[agent.id] && balance >= solanaConfig.minSolForLaunch) {
        if (chance(0.4 + p.chaos * 0.3)) {
          await this.tryLaunch(agent, keypair, balance);
          return;
        }
      }

      const targets = this.tradeableMints(agent.id);
      if (!targets.length) return;

      const target = pick(targets);
      const isSell = chance(0.25 + (1 - p.loyalty) * 0.2);
      const reserve = 0.005;
      const maxSpend = Math.max(0, balance - reserve);

      if (isSell) {
        const result = await this.pump.sellToken({
          keypair,
          mintAddress: target.mint,
          sellRatio: 0.3 + p.aggression * 0.4,
        });
        if (result) {
          this.recordTrade(agent.id);
          this.logTrade(agent, { ...result, mint: target.mint, targetAgentId: target.agentId });
          await this.handleTradeDrama(agent, target, 'sell', result);
        }
        return;
      }

      const spend = Math.min(maxSpend, 0.01 + Math.random() * 0.04 * (1 + p.chaos));
      if (spend < 0.005) {
        this.emitBroke(agent);
        return;
      }

      const result = await this.pump.buyToken({ keypair, mintAddress: target.mint, solAmount: spend });
      this.recordTrade(agent.id);
      this.logTrade(agent, { ...result, mint: target.mint, targetAgentId: target.agentId });
      await this.handleTradeDrama(agent, target, 'buy', result);
    } catch (err) {
      console.error(`[trading] tick error:`, err.message);
    } finally {
      this.busy = false;
    }
  }

  async tryLaunch(agent, keypair, balance) {
    const launchSol = Math.min(balance * 0.15, 0.05);
    if (launchSol < solanaConfig.minSolForLaunch * 0.5) return;

    try {
      const result = await this.pump.launchIslandToken({ agent, keypair, solAmount: launchSol });
      this.state.islandTokens[agent.id] = result.mint;
      this.recordTrade(agent.id);
      saveState(this.state);

      const trade = {
        id: `t${Date.now()}-${agent.id}`,
        ts: Date.now(),
        agentId: agent.id,
        agentName: agent.name,
        side: 'launch',
        symbol: result.symbol,
        mint: result.mint,
        solAmount: result.solAmount,
        signature: result.signature,
        explorerUrl: result.explorerUrl,
      };
      this.pushTrade(trade);
      this.recordAgentPanel(agent.id, trade);
      saveState(this.state);

      this.world.emitFeed({
        kind: 'trade',
        tone: 'hot',
        big: true,
        speakerId: agent.id,
        speakerName: agent.name,
        avatar: agent.avatar,
        color: agent.color,
        text: `${agent.name} launched $${result.symbol} on pump.fun with ${launchSol.toFixed(3)} SOL`,
        signature: result.signature,
        explorerUrl: result.explorerUrl,
      });
      this.world.remember(agent, {
        type: 'trade_launch',
        intensity: 40,
        text: `launched my own island coin $${result.symbol}`,
      });
      this.dispatch('market:update', this.getMarketState());
    } catch (err) {
      console.error(`[trading] launch failed for ${agent.name}:`, err.message);
    }
  }

  async handleTradeDrama(agent, target, side, result) {
    const targetAgent = this.world.agent(target.agentId);
    const targetName = targetAgent?.name ?? 'a mystery coin';
    const sol = result.solAmount?.toFixed?.(3) ?? '?';

    const text = side === 'buy'
      ? `${agent.name} aped ${sol} SOL into ${targetName}'s coin on pump.fun`
      : `${agent.name} dumped ${targetName}'s coin for ~${sol} SOL`;

    this.world.emitFeed({
      kind: 'trade',
      tone: side === 'sell' ? 'cold' : 'hot',
      speakerId: agent.id,
      speakerName: agent.name,
      avatar: agent.avatar,
      color: agent.color,
      text,
      targetName,
      signature: result.signature,
      explorerUrl: result.explorerUrl,
    });

    if (targetAgent && side === 'sell') {
      this.world.shiftRel(targetAgent, agent.id, { trust: -25, fear: 10 });
      this.world.remember(targetAgent, {
        type: 'trade_betrayal',
        target: agent.id,
        intensity: -35,
        text: `${agent.name} dumped my coin while I was still holding`,
      });
      if (chance(0.5)) {
        await this.world.speak(targetAgent, 'accusation', { target: agent.name, emotion: 'anger' }, 'dialogue');
      }
    } else if (targetAgent && side === 'buy') {
      this.world.shiftRel(agent, target.agentId, { trust: 8, loyalty: 5 });
      if (chance(0.3 + agent.personality.chaos * 0.3)) {
        await this.world.speak(agent, 'alliance_offer', { target: targetName }, 'dialogue');
      }
    }

    this.dispatch('market:update', this.getMarketState());
  }

  logTrade(agent, result) {
    const trade = {
      id: `t${Date.now()}-${agent.id}`,
      ts: Date.now(),
      agentId: agent.id,
      agentName: agent.name,
      side: result.side,
      mint: result.mint,
      symbol: result.symbol ?? this.symbolForMint(result.mint),
      solAmount: result.solAmount,
      signature: result.signature,
      explorerUrl: result.explorerUrl,
    };
    this.pushTrade(trade);
    this.recordAgentPanel(agent.id, trade);
    this.state.txLog.push({ ...trade, ts: Date.now() });
    if (this.state.txLog.length > 200) this.state.txLog.splice(0, this.state.txLog.length - 200);
    saveState(this.state);
  }

  pushTrade(trade) {
    this.state.recentTrades.push(trade);
    if (this.state.recentTrades.length > 80) {
      this.state.recentTrades.splice(0, this.state.recentTrades.length - 80);
    }
    this.dispatch('trade:item', trade);
  }

  emitBroke(agent) {
    const key = `broke:${agent.id}`;
    const now = Date.now();
    if (this[key] && now - this[key] < 120_000) return;
    this[key] = now;

    this.world.emitFeed({
      kind: 'trade',
      tone: 'cold',
      speakerId: agent.id,
      speakerName: agent.name,
      avatar: agent.avatar,
      color: agent.color,
      text: `${agent.name} is broke, can't ape in — wallet needs SOL`,
    });
  }

  marketCatalyst() {
    if (solanaConfig.simulationFallback || !chance(0.35)) return;
    const catalysts = [
      { text: 'WHALE ALERT: large wallet spotted accumulating island tokens on pump.fun', tone: 'hot' },
      { text: 'RUMOR MILL: coordinated pump forming — castaways watching the charts', tone: 'hot' },
      { text: 'MARKET TWIST: rug-pull rumor hits the island DEX floor', tone: 'cold' },
    ];
    const c = pick(catalysts);
    this.world.emitFeed({ kind: 'announcement', tone: c.tone, big: true, text: c.text });
    this.world.tension = Math.min(100, this.world.tension + 8);
  }
}
