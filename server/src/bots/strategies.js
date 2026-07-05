/** Bot type selection — only affects token ranking, not trading rules. */

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const BOT_TYPES = ['sniper', 'momentum', 'lowcap', 'whale', 'meme'];

export function selectToken(botType, candidates) {
  if (!candidates.length) return null;
  const pool = [...candidates];

  switch (botType) {
    case 'sniper':
      // Newest tokens first (higher created timestamp)
      pool.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      return pick(pool.slice(0, Math.min(5, pool.length)));

    case 'momentum':
      // Highest recent activity / volatility
      pool.sort((a, b) => (b.volatility ?? 0) - (a.volatility ?? 0));
      return pick(pool.slice(0, Math.min(5, pool.length)));

    case 'lowcap':
      // Smallest market cap in band
      pool.sort((a, b) => a.usdMarketCap - b.usdMarketCap);
      return pool[0];

    case 'whale':
      // Highest market cap in band (more activity)
      pool.sort((a, b) => b.usdMarketCap - a.usdMarketCap);
      return pick(pool.slice(0, Math.min(5, pool.length)));

    case 'meme':
    default:
      return pick(pool);
  }
}

export function defaultTradingRules() {
  return {
    minMarketCap: 2500,
    maxMarketCap: 6000,
    buyAmountSol: 0.015,
    takeProfitPercent: 8,
    stopLossPercent: 5,
  };
}

export function normalizeRules(input = {}) {
  const d = defaultTradingRules();
  return {
    minMarketCap: Number(input.minMarketCap) || d.minMarketCap,
    maxMarketCap: Number(input.maxMarketCap) || d.maxMarketCap,
    buyAmountSol: Number(input.buyAmountSol) || d.buyAmountSol,
    takeProfitPercent: Number(input.takeProfitPercent) || d.takeProfitPercent,
    stopLossPercent: Number(input.stopLossPercent) || d.stopLossPercent,
  };
}
