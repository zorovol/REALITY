/** Bot type selection — each AI agent uses a different token ranking style. */

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const BOT_TYPES = ['chatgpt', 'grok', 'fable', 'gemini', 'deepseek'];

/** Legacy ids from before AI naming. */
const LEGACY = {
  sniper: 'chatgpt',
  momentum: 'grok',
  meme: 'fable',
  whale: 'gemini',
  lowcap: 'deepseek',
};

function normalizeType(botType) {
  return LEGACY[botType] || botType;
}

export function selectToken(botType, candidates) {
  if (!candidates.length) return null;
  const pool = [...candidates];
  const type = normalizeType(botType);

  switch (type) {
    case 'chatgpt':
      pool.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      return pick(pool.slice(0, Math.min(5, pool.length)));

    case 'grok':
      pool.sort((a, b) => (b.volatility ?? 0) - (a.volatility ?? 0));
      return pick(pool.slice(0, Math.min(5, pool.length)));

    case 'deepseek':
      pool.sort((a, b) => a.usdMarketCap - b.usdMarketCap);
      return pool[0];

    case 'gemini':
      pool.sort((a, b) => b.usdMarketCap - a.usdMarketCap);
      return pick(pool.slice(0, Math.min(5, pool.length)));

    case 'fable':
    default:
      return pick(pool);
  }
}

export function defaultTradingRules() {
  return {
    minMarketCap: 2_500,
    maxMarketCap: 500_000,
    buyAmountEth: 0.0005,
    buyAmountSol: 0.0005,
    takeProfitPercent: 8,
    stopLossPercent: 5,
  };
}

export function normalizeRules(input = {}) {
  const d = defaultTradingRules();
  const buyEth = Number(input.buyAmountEth ?? input.buyAmountSol) || d.buyAmountEth;
  return {
    minMarketCap: Number(input.minMarketCap) || d.minMarketCap,
    maxMarketCap: Number(input.maxMarketCap) || d.maxMarketCap,
    buyAmountEth: buyEth,
    buyAmountSol: buyEth,
    takeProfitPercent: Number(input.takeProfitPercent) || d.takeProfitPercent,
    stopLossPercent: Number(input.stopLossPercent) || d.stopLossPercent,
  };
}
