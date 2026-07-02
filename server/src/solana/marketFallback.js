import { CAST_POOL } from '../engine/cast.js';

const BOT_IDS = CAST_POOL.map((c) => c.name.toLowerCase());

export function buildSkeletonMarket(wallets = {}) {
  const agentPanels = CAST_POOL.map((template) => {
    const id = template.name.toLowerCase();
    const wallet = wallets[id] ?? {
      address: null,
      addressShort: '—',
      sol: 0,
      funded: false,
      simulation: false,
    };
    return {
      id,
      name: template.name,
      tagline: template.tagline,
      modelLabel: template.modelLabel,
      color: template.color,
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
    mode: 'real',
    network: 'mainnet-beta',
    disclaimer: 'REAL TRADING — user-funded agent wallets. Not financial advice.',
    recentTrades: [],
    islandTokens: {},
    wallets,
    agentPanels,
    tradesByAgent: Object.fromEntries(BOT_IDS.map((id) => [id, []])),
  };
}
