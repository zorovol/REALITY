/** Bot type selection — each AI agent ranks Ethereum stock tokens differently. */

import { config } from '../config.js';

export const BOT_TYPES = ['chatgpt', 'grok', 'fable', 'gemini', 'deepseek'];

/** Default buy size from BOT_BUY_USD / ETH_USD. */
export function defaultBuyAmountEth() {
  const eth = config.botBuyUsd / config.ethUsdFallback;
  return Math.round(eth * 1_000_000) / 1_000_000;
}

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

export function rankCandidates(botType, candidates) {
  if (!candidates.length) return [];
  const pool = [...candidates];
  const type = normalizeType(botType);

  switch (type) {
    case 'chatgpt':
      pool.sort((a, b) => (b.volumeH24 ?? 0) - (a.volumeH24 ?? 0));
      return pool;
    case 'grok':
      pool.sort((a, b) => (b.volatility ?? 0) - (a.volatility ?? 0));
      return pool;
    case 'deepseek':
      pool.sort((a, b) => (a.liquidityUsd ?? 0) - (b.liquidityUsd ?? 0));
      return pool;
    case 'gemini':
      pool.sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
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

export function buildTradeCandidateOrder(botType, candidates) {
  if (!candidates.length) return [];
  const ranked = rankCandidates(botType, candidates);
  const liquid = [...candidates].sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
  const merged = [];
  const seen = new Set();
  const push = (t) => {
    if (!t || seen.has(t.address)) return;
    seen.add(t.address);
    merged.push(t);
  };
  const maxLen = Math.max(ranked.length, liquid.length);
  for (let i = 0; i < maxLen; i += 1) {
    push(ranked[i]);
    push(liquid[i]);
  }
  return merged;
}

export function defaultTradingRules() {
  const buyEth = defaultBuyAmountEth();
  return {
    minMarketCap: 10_000,
    maxMarketCap: 50_000_000,
    buyAmountEth: buyEth,
    buyAmountSol: buyEth,
    takeProfitPercent: 3,
    stopLossPercent: 2,
  };
}

export function normalizeRules(input = {}) {
  const d = defaultTradingRules();
  let buyEth = Number(input.buyAmountEth ?? input.buyAmountSol) || d.buyAmountEth;
  // Migrate tiny L2-era defaults up to L1-sane sizes
  if (buyEth <= 0.0015) buyEth = d.buyAmountEth;

  let minMarketCap = Number(input.minMarketCap) || d.minMarketCap;
  let maxMarketCap = Number(input.maxMarketCap) || d.maxMarketCap;
  if (minMarketCap === 500 || minMarketCap === 1_000 || minMarketCap === 2_500) minMarketCap = d.minMarketCap;
  if (maxMarketCap === 500_000 || maxMarketCap === 10_000_000) maxMarketCap = d.maxMarketCap;

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
