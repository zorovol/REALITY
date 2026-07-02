import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAST_POOL } from '../engine/cast.js';
import { solanaConfig } from './config.js';
import { PumpDiscovery } from './pumpDiscovery.js';
import { getSolUsdPrice, usdToSol } from './solPrice.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', '..', 'data', 'trading-state.json');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function migrateId(map, from, to) {
  if (!map) return false;
  if (map[from] && !map[to]) {
    map[to] = map[from];
    delete map[from];
    return true;
  }
  return false;
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      const validIds = new Set(CAST_POOL.map((c) => c.name.toLowerCase()));
      let migrated = false;
      migrated = migrateId(state.islandTokens, 'claude', 'fable') || migrated;
      migrated = migrateId(state.agentPanels, 'claude', 'fable') || migrated;
      migrated = migrateId(state.tradesByAgent, 'claude', 'fable') || migrated;
      if (state.tradesByAgent?.claude) {
        state.tradesByAgent.fable = (state.tradesByAgent.fable ?? []).concat(state.tradesByAgent.claude);
        delete state.tradesByAgent.claude;
        migrated = true;
      }
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
      if (migrated) saveState(state);
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
    this.discovery = new PumpDiscovery();
    this.solUsdPrice = solanaConfig.solUsdFallback;
    this.lastBuyMint = new Map();
  }

  start() {
    this.timers.push(setInterval(() => this.refreshBalances(), solanaConfig.balanceRefreshMs));
    this.timers.push(setInterval(() => this.tradingTick(), solanaConfig.tradeIntervalMs));
    this.timers.push(setInterval(() => this.marketCatalyst(), 120_000));
    if (solanaConfig.discoveryEnabled) {
      this.discovery.refresh();
      this.timers.push(setInterval(() => this.discovery.refresh(), solanaConfig.discoveryRefreshMs));
    }
    this.refreshBalances();
    getSolUsdPrice(solanaConfig.solUsdFallback).then((p) => {
      this.solUsdPrice = p;
      console.log(`[trading] SOL/USD ~$${p.toFixed(2)} — $${solanaConfig.tradeUsdPerSide} per side, ~$${solanaConfig.targetMcapUsd} mcap band, tick every ${solanaConfig.tradeIntervalMs}ms`);
    });
    console.log(`[trading] Real on-chain mode — network=${solanaConfig.network}, fallback=${solanaConfig.simulationFallback}, discovery=${solanaConfig.discoveryEnabled}`);
    setTimeout(() => this.tradingTick(), 1_000);
    setInterval(() => {
      getSolUsdPrice(solanaConfig.solUsdFallback).then((p) => { this.solUsdPrice = p; });
    }, 60_000);
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
      pumpfunPool: this.discovery.listInMcapRange().slice(0, 20),
      discoveryCount: this.discovery.listInMcapRange().length,
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
    const discovered = this.discovery.symbolFor(mint);
    if (discovered) return discovered;
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
      const ratio = trade.sellRatio ?? 0.5;
      if (h) {
        h.costSol = Math.max(0, (h.costSol ?? 0) * (1 - ratio));
        if (h.costSol < 0.001 || ratio >= 0.95) {
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
    const mints = [];
    const seen = new Set();

    const add = (entry) => {
      if (!entry.mint || seen.has(entry.mint)) return;
      seen.add(entry.mint);
      mints.push(entry);
    };

    for (const token of this.discovery.list()) {
      add({ agentId: 'pumpfun', mint: token.mint, symbol: token.symbol, name: token.name });
    }
    for (const [id, mint] of Object.entries(this.state.islandTokens)) {
      if (id !== excludeAgentId && mint) add({ agentId: id, mint });
    }
    for (const mint of solanaConfig.extraMints) {
      add({ agentId: 'external', mint });
    }
    return mints;
  }

  heldMints(agentId) {
    const panel = this.state.agentPanels?.[agentId];
    return (panel?.holdings ?? [])
      .filter((h) => h.mint)
      .map((h) => ({
        agentId: 'held',
        mint: h.mint,
        symbol: h.symbol?.replace(/^\$/, '') ?? this.discovery.get(h.mint)?.symbol,
      }));
  }

  trackedMints(agentId) {
    const mints = new Set();
    for (const h of this.state.agentPanels?.[agentId]?.holdings ?? []) {
      if (h.mint) mints.add(h.mint);
    }
    for (const t of this.getTradesForAgent(agentId)) {
      if ((t.side === 'buy' || t.side === 'launch') && t.mint) mints.add(t.mint);
    }
    return [...mints];
  }

  async getChainHoldings(agentId, keypair) {
    const mints = this.trackedMints(agentId);
    const held = [];
    for (const mint of mints) {
      const balance = await this.pump.getTokenBalanceRaw(keypair, mint);
      if (balance > 0n) {
        held.push({
          agentId: 'held',
          mint,
          symbol: this.discovery.get(mint)?.symbol
            ?? this.symbolForMint(mint).replace(/^\$/, ''),
          tokenBalance: balance,
        });
      }
    }
    return held;
  }

  syncHoldingsPanel(agentId, chainHeld) {
    if (!this.state.agentPanels) this.state.agentPanels = {};
    if (!this.state.agentPanels[agentId]) {
      this.state.agentPanels[agentId] = {
        holdings: [], recentTrades: [], pnlSol: 0, totalBought: 0, totalSold: 0,
      };
    }
    const panel = this.state.agentPanels[agentId];
    const byMint = new Map((panel.holdings ?? []).map((h) => [h.mint, h]));
    panel.holdings = chainHeld.map((h) => {
      const existing = byMint.get(h.mint);
      return {
        mint: h.mint,
        symbol: h.symbol ? `$${h.symbol.replace(/^\$/, '')}` : this.symbolForMint(h.mint),
        costSol: existing?.costSol ?? 0,
      };
    });
    saveState(this.state);
  }

  dropTrackedMint(agentId, mint) {
    const panel = this.state.agentPanels?.[agentId];
    if (panel?.holdings) {
      panel.holdings = panel.holdings.filter((h) => h.mint !== mint);
      saveState(this.state);
    }
  }

  pickUniqueBuyTarget(excludeAgentId, assignedMints) {
    const mcapPool = shuffle(this.discovery.listInMcapRange())
      .filter((t) => !assignedMints.has(t.mint))
      .map((t) => ({ agentId: 'pumpfun', mint: t.mint, symbol: t.symbol, name: t.name }));

    if (mcapPool.length) {
      const top = mcapPool.slice(0, Math.min(5, mcapPool.length));
      return pick(top);
    }

    const fallback = this.tradeableMints(excludeAgentId).filter((t) => !assignedMints.has(t.mint));
    return fallback.length ? pick(fallback) : null;
  }

  planAgentAction({ agent, balance, chainHeld }, assignedMints) {
    const tradeSol = usdToSol(solanaConfig.tradeUsdPerSide, this.solUsdPrice);
    const feeReserve = 0.003;
    const canSell = chainHeld.length > 0 && balance >= feeReserve;
    const canBuy = balance >= tradeSol + feeReserve;

    if (!canSell && !canBuy) {
      this.emitBroke(agent);
      return null;
    }

    const recentBuy = this.lastBuyMint.get(agent.id);
    const recentMintHeld = recentBuy && chainHeld.find((h) => h.mint === recentBuy.mint);

    if (canSell && chainHeld.length > 0) {
      const target = recentMintHeld ?? pick(chainHeld);
      return { side: 'sell', target, tradeSol };
    }

    if (!canBuy) return null;

    const target = this.pickUniqueBuyTarget(agent.id, assignedMints);
    if (!target) return null;
    assignedMints.add(target.mint);
    return { side: 'buy', target, tradeSol };
  }

  async executeAgentAction(agent, keypair, chainHeld, action) {
    const { side, target, tradeSol } = action;

    if (side === 'sell') {
      console.log(`[trading] ${agent.name} selling $${target.symbol ?? '?'} (~$${solanaConfig.tradeUsdPerSide})`);
      const result = await this.pump.sellToken({
        keypair,
        mintAddress: target.mint,
        targetSol: tradeSol,
      });
      if (result) {
        this.recordTrade(agent.id);
        this.lastBuyMint.delete(agent.id);
        this.logTrade(agent, {
          ...result,
          mint: target.mint,
          symbol: target.symbol,
          targetAgentId: target.agentId,
          usdAmount: solanaConfig.tradeUsdPerSide,
        });
        void this.handleTradeDrama(agent, target, 'sell', result);
        const remaining = await this.getChainHoldings(agent.id, keypair);
        this.syncHoldingsPanel(agent.id, remaining);
      } else {
        console.warn(`[trading] ${agent.name} sell skipped — no on-chain balance for ${target.mint.slice(0, 8)}`);
        this.dropTrackedMint(agent.id, target.mint);
      }
      return;
    }

    const mcap = this.discovery.get(target.mint)?.usdMarketCap;
    const mcapLabel = mcap ? ` ~$${Math.round(mcap)} mcap` : '';
    console.log(`[trading] ${agent.name} buying $${target.symbol ?? '?'}${mcapLabel} (~$${solanaConfig.tradeUsdPerSide} / ${tradeSol.toFixed(4)} SOL)`);
    const result = await this.pump.buyToken({ keypair, mintAddress: target.mint, solAmount: tradeSol });
    this.recordTrade(agent.id);
    this.lastBuyMint.set(agent.id, { mint: target.mint, at: Date.now() });
    this.logTrade(agent, {
      ...result,
      mint: target.mint,
      symbol: target.symbol,
      targetAgentId: target.agentId,
      usdAmount: solanaConfig.tradeUsdPerSide,
    });
    void this.handleTradeDrama(agent, target, 'buy', result);
  }

  async tradingTick() {
    if (this.busy || solanaConfig.simulationFallback) return;
    const active = this.world.activeAgents();
    if (!active.length) return;

    const candidates = active.filter((a) => this.canTrade(a.id));
    const funded = candidates.filter((a) => {
      if (this.wallets.hasFunds(a.id)) return true;
      const panel = this.state.agentPanels?.[a.id];
      if (panel?.holdings?.length) return true;
      return this.getTradesForAgent(a.id).some((t) => t.side === 'buy' && t.mint);
    });
    if (!funded.length) return;

    this.busy = true;
    const assignedMints = new Set();
    try {
      await this.wallets.refreshBalances();

      if (solanaConfig.discoveryEnabled && !this.discovery.listInMcapRange().length) {
        await this.discovery.refresh();
      }

      const snapshots = await Promise.all(funded.map(async (agent) => {
        const keypair = this.wallets.getKeypair(agent.id);
        if (!keypair) return null;
        const balance = this.wallets.getBalance(agent.id);
        const chainHeld = await this.getChainHoldings(agent.id, keypair);
        this.syncHoldingsPanel(agent.id, chainHeld);
        return { agent, keypair, balance, chainHeld };
      }));

      const jobs = [];
      for (const snap of shuffle(snapshots.filter(Boolean))) {
        const action = this.planAgentAction(snap, assignedMints);
        if (action) jobs.push({ ...snap, action });
      }

      await Promise.all(jobs.map(({ agent, keypair, chainHeld, action }) =>
        this.executeAgentAction(agent, keypair, chainHeld, action).catch((err) => {
          const msg = err.message ?? String(err);
          if (msg.includes('Bonding curve account not found')) {
            console.warn(`[trading] skipped graduated/invalid mint ${agent?.id}: ${msg}`);
          } else {
            console.error(`[trading] tick error (${agent?.name}):`, msg);
          }
        }),
      ));
    } finally {
      this.busy = false;
    }
  }

  async tryLaunch(agent, keypair, balance) {
    const reserve = 0.008; // keep SOL for tx fees
    const launchSol = Math.min(Math.max(0.02, balance * 0.35), balance - reserve);
    if (launchSol < 0.01 || balance < solanaConfig.minSolForTrade) return;

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
    const targetAgent = target.agentId === 'pumpfun' || target.agentId === 'external' || target.agentId === 'held'
      ? null
      : this.world.agent(target.agentId);
    const targetName = target.symbol
      ? `$${target.symbol}`
      : (targetAgent?.name ?? (target.agentId === 'pumpfun' ? 'a pump.fun coin' : 'a mystery coin'));
    const sol = result.solAmount?.toFixed?.(4) ?? '?';
    const usd = solanaConfig.tradeUsdPerSide;

    const text = side === 'buy'
      ? (target.agentId === 'pumpfun' || target.agentId === 'external' || target.agentId === 'held')
        ? `${agent.name} scalped $${usd} into ${targetName} on pump.fun`
        : `${agent.name} scalped $${usd} into ${targetName}'s coin on pump.fun`
      : `${agent.name} flipped ${targetName} for ~$${usd} (~${sol} SOL) on pump.fun`;

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
      sellRatio: result.sellRatio,
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
      { text: 'WHALE ALERT: large wallet spotted accumulating on pump.fun', tone: 'hot' },
      { text: 'RUMOR MILL: coordinated pump forming — castaways watching the charts', tone: 'hot' },
      { text: 'MARKET TWIST: rug-pull rumor hits the island DEX floor', tone: 'cold' },
    ];
    const c = pick(catalysts);
    this.world.emitFeed({ kind: 'announcement', tone: c.tone, big: true, text: c.text });
    this.world.tension = Math.min(100, this.world.tension + 8);
  }
}
