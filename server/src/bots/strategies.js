/** Bot type selection — each AI agent uses a different token ranking style. */

import { config } from '../config.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

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

/** Rank launchpad candidates for a bot type (first = highest priority). */
export function rankCandidates(botType, candidates) {
  if (!candidates.length) return [];
  const pool = [...candidates];
  const type = normalizeType(botType);

  switch (type) {
    case 'chatgpt':
      pool.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      return pool;

    case 'grok':
      pool.sort((a, b) => (b.volatility ?? 0) - (a.volatility ?? 0));
      return pool;

    case 'deepseek':
      pool.sort((a, b) => a.usdMarketCap - b.usdMarketCap);
      return pool;

    case 'gemini':
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

/** Merge strategy-ranked tokens with older launchpad coins so bots trade both. */
export function buildTradeCandidateOrder(botType, candidates) {
  if (!candidates.length) return [];
  const ranked = rankCandidates(botType, candidates);
  const oldest = [...candidates].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const merged = [];
  const seen = new Set();

  const push = (t) => {
    if (!t || seen.has(t.address)) return;
    seen.add(t.address);
    merged.push(t);
  };

  const maxLen = Math.max(ranked.length, oldest.length);
  for (let i = 0; i < maxLen; i += 1) {
    push(ranked[i]);
    push(oldest[i]);
  }

  return merged;
}

export function defaultTradingRules() {
  const buyEth = defaultBuyAmountEth();
  return {
    // Ape.Store / NOXA launches on Robinhood are typically ~$1.5k–$2.5k mcap at deploy.
    minMarketCap: 500,
    maxMarketCap: 500_000,
    buyAmountEth: buyEth,
    buyAmountSol: buyEth,
    takeProfitPercent: 8,
    stopLossPercent: 5,
  };
}

export function normalizeRules(input = {}) {
  const d = defaultTradingRules();
  let buyEth = Number(input.buyAmountEth ?? input.buyAmountSol) || d.buyAmountEth;
  if (buyEth === 0.0005) buyEth = d.buyAmountEth;
  let minMarketCap = Number(input.minMarketCap) || d.minMarketCap;
  // Legacy default blocked ~$1.6k launchpad tokens on Ape.Store / NOXA.
  if (minMarketCap === 2_500) minMarketCap = d.minMarketCap;
  return {
    minMarketCap,
    maxMarketCap: Number(input.maxMarketCap) || d.maxMarketCap,
    buyAmountEth: buyEth,
    buyAmountSol: buyEth,
    takeProfitPercent: Number(input.takeProfitPercent) || d.takeProfitPercent,
    stopLossPercent: Number(input.stopLossPercent) || d.stopLossPercent,
  };
}
