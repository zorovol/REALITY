/** Bot type selection — each AI agent ranks Robinhood stock tokens differently. */

import { config } from '../config.js';

export const BOT_TYPES = ['chatgpt', 'grok', 'fable', 'gemini', 'deepseek'];

/** ~$5 per buy at configured ETH/USD (default 0.001429 ETH @ $3500). */
export function defaultBuyAmountEth() {
  const eth = config.botBuyUsd / config.ethUsdFallback;
  return Math.round(eth * 1_000_000) / 1_000_000;
}

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

/** Rank stock-token candidates for a bot type (first = highest priority). */
export function rankCandidates(botType, candidates) {
  if (!candidates.length) return [];
  const pool = [...candidates];
  const type = normalizeType(botType);

  switch (type) {
    case 'chatgpt':
      // Most traded — highest 24h on-chain volume.
      pool.sort((a, b) => (b.volumeH24 ?? 0) - (a.volumeH24 ?? 0));
      return pool;

    case 'grok':
      // Turnover hunter — volume relative to on-chain cap.
      pool.sort((a, b) => (b.volatility ?? 0) - (a.volatility ?? 0));
      return pool;

    case 'deepseek':
      // Smallest on-chain caps — thin, fast-moving stock pools.
      pool.sort((a, b) => a.usdMarketCap - b.usdMarketCap);
      return pool;

    case 'gemini':
      // Blue chips — biggest on-chain caps (NVDA, AAPL, TSLA…).
      pool.sort((a, b) => b.usdMarketCap - a.usdMarketCap);
      return pool;

    case 'fable':
    default:
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool;
  }
}

/** Merge strategy-ranked stocks with most-held names so bots see both. */
export function buildTradeCandidateOrder(botType, candidates) {
  if (!candidates.length) return [];
  const ranked = rankCandidates(botType, candidates);
  const popular = [...candidates].sort((a, b) => (b.holders ?? 0) - (a.holders ?? 0));
  const merged = [];
  const seen = new Set();

  const push = (t) => {
    if (!t || seen.has(t.address)) return;
    seen.add(t.address);
    merged.push(t);
  };

  const maxLen = Math.max(ranked.length, popular.length);
  for (let i = 0; i < maxLen; i += 1) {
    push(ranked[i]);
    push(popular[i]);
  }

  return merged;
}

export function defaultTradingRules() {
  const buyEth = defaultBuyAmountEth();
  return {
    // On-chain circulating caps of Robinhood stock tokens: ~$1k (long tail) to ~$1M (NVDA/AAPL).
    minMarketCap: 1_000,
    maxMarketCap: 10_000_000,
    buyAmountEth: buyEth,
    buyAmountSol: buyEth,
    // Tokenized stocks move slower than memecoins — tighter bands.
    takeProfitPercent: 3,
    stopLossPercent: 2,
  };
}

export function normalizeRules(input = {}) {
  const d = defaultTradingRules();
  let buyEth = Number(input.buyAmountEth ?? input.buyAmountSol) || d.buyAmountEth;
  if (buyEth === 0.0005) buyEth = d.buyAmountEth;

  let minMarketCap = Number(input.minMarketCap) || d.minMarketCap;
  let maxMarketCap = Number(input.maxMarketCap) || d.maxMarketCap;
  // Migrate memecoin-era defaults to the stock-token band.
  if (minMarketCap === 500 || minMarketCap === 2_500) minMarketCap = d.minMarketCap;
  if (maxMarketCap === 500_000) maxMarketCap = d.maxMarketCap;

  let takeProfitPercent = Number(input.takeProfitPercent) || d.takeProfitPercent;
  let stopLossPercent = Number(input.stopLossPercent) || d.stopLossPercent;
  if (takeProfitPercent === 8) takeProfitPercent = d.takeProfitPercent;
  if (stopLossPercent === 5) stopLossPercent = d.stopLossPercent;

  return {
    minMarketCap,
    maxMarketCap,
    buyAmountEth: buyEth,
    buyAmountSol: buyEth,
    takeProfitPercent,
    stopLossPercent,
  };
}
