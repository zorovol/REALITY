import { CAST_POOL } from '../sim/cast.js';

const BOT_IDS = ['chatgpt', 'grok', 'fable', 'gemini', 'deepseek'];

/** Migrate legacy claude id → fable in persisted snapshots. */
export function migrateSnapshotAgents(snap) {
  if (!snap?.agents?.length) return snap;
  let changed = false;
  const agents = snap.agents.map((a) => {
    if (a.id !== 'claude') return a;
    changed = true;
    return { ...a, id: 'fable', name: 'Fable', modelLabel: a.modelLabel ?? 'Narrative Core', tagline: a.tagline ?? 'The Storyteller' };
  });
  if (!changed) return snap;
  return { ...snap, agents };
}

export function isValidSnapshot(snap) {
  if (!snap || snap.v !== 6 || !Array.isArray(snap.agents) || snap.agents.length !== 5) return false;
  const ids = new Set(snap.agents.map((a) => a.id));
  return BOT_IDS.every((id) => ids.has(id));
}

function simWallet(id) {
  return {
    address: `sim-${id}-local`,
    addressShort: `sim…${id.slice(0, 4)}`,
    sol: 0,
    funded: false,
    simulation: true,
  };
}

/** Build full market payload when server/local sim omits agentPanels. */
export function buildFallbackMarket({ agents = [], wallets = {}, mode = 'local', recentTrades = [] } = {}) {
  const walletMap = { ...wallets };
  for (const id of BOT_IDS) {
    if (!walletMap[id]) walletMap[id] = simWallet(id);
  }

  const agentPanels = CAST_POOL.map((template) => {
    const id = template.name.toLowerCase();
    const agent = agents.find((a) => a.id === id);
    const wallet = walletMap[id] ?? simWallet(id);
    return {
      id,
      name: template.name,
      tagline: template.tagline,
      modelLabel: template.modelLabel,
      color: agent?.color ?? template.color,
      wallet,
      islandToken: null,
      holdings: [],
      trades: [],
      recentTrades: [],
      pnlSol: 0,
      positionStatus: wallet.funded ? 'ready' : 'unfunded',
    };
  });

  return {
    mode,
    network: mode === 'local' ? 'local-sim' : 'mainnet-beta',
    disclaimer: mode === 'local'
      ? 'LOCAL MODE — server unreachable. Simulated trading floor.'
      : 'REAL TRADING — user-funded agent wallets. Not financial advice.',
    minSolRecommended: 0.01,
    islandTokens: {},
    recentTrades,
    wallets: walletMap,
    agentPanels,
    tradesByAgent: Object.fromEntries(BOT_IDS.map((id) => [id, []])),
  };
}

/** Merge API market with guaranteed 5 agent panels. */
export function ensureMarket(market, world) {
  const panels = market?.agentPanels;
  if (Array.isArray(panels) && panels.length >= 5) return market;

  const fallback = buildFallbackMarket({
    agents: world?.agents ?? [],
    wallets: market?.wallets ?? {},
    mode: market?.mode ?? 'local',
    recentTrades: market?.recentTrades ?? [],
  });

  if (!market) return fallback;

  const byId = new Map((panels ?? []).map((p) => [p.id, p]));
  return {
    ...fallback,
    ...market,
    agentPanels: BOT_IDS.map((id) => byId.get(id) ?? fallback.agentPanels.find((p) => p.id === id)),
    wallets: { ...fallback.wallets, ...(market.wallets ?? {}) },
    tradesByAgent: { ...fallback.tradesByAgent, ...(market.tradesByAgent ?? {}) },
  };
}

export { BOT_IDS };
