import { ethers } from 'ethers';
import { config } from '../config.js';
import { ethereumMainnet } from '../chain/ethereum.js';

const WETH = ethereumMainnet.weth.toLowerCase();
const USDC = ethereumMainnet.usdc.toLowerCase();
const STABLES = new Set([USDC, '0xdac17f958d2ee523a2206206994597c13d831ec7']); // USDT

/** Search queries for Ondo (`*on`) and xStocks (`*x`) trackers. */
const SEARCH_TICKERS = [
  'NVDAon', 'TSLAon', 'AAPLon', 'GOOGLon', 'AMZNon', 'MSFTon', 'METALon',
  'SPYon', 'QQQon', 'SPCXon', 'PLTRon', 'COINon', 'CRCLon', 'AMDLon',
  'NVDAx', 'TSLAx', 'AAPLx', 'SPYx', 'QQQx', 'METAx', 'MSFTx',
];

async function fetchJson(url, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i += 1) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      lastErr = err;
      if (i < retries) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

function isStockSymbol(sym) {
  const s = String(sym || '');
  return /on$/i.test(s) || /x$/i.test(s);
}

function pickRoute(pair) {
  const base = pair.baseToken;
  const quote = pair.quoteToken;
  const quoteAddr = String(quote.address).toLowerCase();
  const baseAddr = String(base.address).toLowerCase();
  const feeHint = Number(pair.feeTier?.[0] || pair.labels?.includes?.('v3') && 3000) || 3000;

  // Prefer stock as base
  let stock = base;
  let other = quote;
  let otherAddr = quoteAddr;
  if (!isStockSymbol(base.symbol) && isStockSymbol(quote.symbol)) {
    stock = quote;
    other = base;
    otherAddr = baseAddr;
  }
  if (!isStockSymbol(stock.symbol)) return null;

  const liq = Number(pair.liquidity?.usd) || 0;
  const priceUsd = Number(pair.priceUsd) || Number(stock.priceUsd) || 0;
  const volumeH24 = Number(pair.volume?.h24) || 0;
  const mcap = Number(pair.fdv || pair.marketCap) || (priceUsd * 1_000_000);

  let routeType = null;
  let fee = 3000;
  if (otherAddr === WETH) {
    routeType = 'weth';
    fee = 3000;
  } else if (STABLES.has(otherAddr)) {
    routeType = 'usdc';
    fee = otherAddr === USDC ? 500 : 3000;
  } else {
    return null;
  }

  // DexScreener doesn't always expose fee tier — try common ones later in trading.
  return {
    mint: String(stock.address).toLowerCase(),
    address: String(stock.address).toLowerCase(),
    symbol: String(stock.symbol).slice(0, 16),
    name: stock.name || stock.symbol,
    priceUsd,
    usdMarketCap: mcap,
    volumeH24,
    liquidityUsd: liq,
    holders: 0,
    decimals: 18,
    routeType,
    quoteToken: otherAddr,
    feeHint: fee,
    feeHintAlt: feeHint,
    pairAddress: pair.pairAddress,
    dexId: pair.dexId,
    labels: pair.labels || [],
    volatility: mcap > 0 ? volumeH24 / mcap : 0,
    tradable: liq >= config.stockMinLiquidityUsd,
    issuer: /on$/i.test(stock.symbol) ? 'ondo' : /x$/i.test(stock.symbol) ? 'xstocks' : 'unknown',
  };
}

async function searchDex(query) {
  const data = await fetchJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`);
  const found = [];
  for (const pair of data.pairs || []) {
    if (pair.chainId !== 'ethereum') continue;
    if (!String(pair.dexId || '').includes('uniswap')) continue;
    const route = pickRoute(pair);
    if (route) found.push(route);
  }
  return found;
}

async function fetchEthUsd() {
  try {
    const data = await fetchJson('https://api.coinbase.com/v2/prices/ETH-USD/spot');
    const price = Number(data?.data?.amount);
    return Number.isFinite(price) && price > 0 ? price : 0;
  } catch {
    return 0;
  }
}

/** Discovers Ethereum tokenized stocks (Ondo / xStocks) with Uniswap liquidity. */
export class StockDiscovery {
  constructor() {
    /** @type {Map<string, object>} */
    this.tokens = new Map();
    this.lastRefresh = 0;
    this.lastError = null;
    this.lastStockCount = 0;
    this.ethUsd = config.ethUsdFallback;
  }

  list() {
    return [...this.tokens.values()];
  }

  get(address) {
    return this.tokens.get(String(address).toLowerCase()) ?? null;
  }

  poolsFor(address) {
    const t = this.get(address);
    if (!t) return [];
    return [{ routeType: t.routeType, fee: t.feeHint, quoteToken: t.quoteToken }];
  }

  async refresh() {
    const now = Date.now();
    if (now - this.lastRefresh < config.stockDiscoveryRefreshMs && this.tokens.size) return;
    this.lastError = null;

    try {
      const price = await fetchEthUsd();
      if (price) this.ethUsd = price;
    } catch { /* keep last */ }

    const merged = new Map();

    // Seed curated addresses first
    for (const seed of config.stockTokens) {
      const addr = String(seed.address).toLowerCase();
      merged.set(addr, {
        mint: addr,
        address: addr,
        symbol: seed.symbol,
        name: seed.symbol,
        priceUsd: Number(seed.priceUsd) || 0,
        usdMarketCap: (Number(seed.priceUsd) || 0) * 500_000,
        volumeH24: 0,
        liquidityUsd: 0,
        holders: 0,
        decimals: 18,
        routeType: 'usdc',
        quoteToken: USDC,
        feeHint: 3000,
        tradable: false,
        volatility: 0,
        issuer: /on$/i.test(seed.symbol) ? 'ondo' : 'xstocks',
      });
    }

    // DexScreener searches (batched, limited concurrency)
    const results = [];
    for (let i = 0; i < SEARCH_TICKERS.length; i += 4) {
      const batch = SEARCH_TICKERS.slice(i, i + 4);
      const part = await Promise.all(batch.map(async (q) => {
        try {
          return await searchDex(q);
        } catch (err) {
          console.warn(`[rwa-discovery] search ${q}:`, err.message);
          return [];
        }
      }));
      results.push(...part.flat());
    }

    for (const t of results) {
      const existing = merged.get(t.address);
      if (!existing || t.liquidityUsd > (existing.liquidityUsd || 0)) {
        // Prefer WETH routes when liquidity is comparable
        if (existing?.routeType === 'weth' && t.routeType === 'usdc'
          && existing.liquidityUsd > t.liquidityUsd * 0.5) {
          continue;
        }
        merged.set(t.address, { ...existing, ...t });
      }
    }

    this.tokens = merged;
    this.lastStockCount = merged.size;
    this.lastRefresh = now;
    const tradable = this.list().filter((t) => t.tradable).length;
    console.log(`[rwa-discovery] ${merged.size} Ethereum stock tokens, ${tradable} with Uniswap liquidity ≥$${config.stockMinLiquidityUsd}`);
  }

  /**
   * Minimum acceptable token output for an ETH buy — half of fair value.
   */
  minOutForBuy(address, ethAmount) {
    const token = this.get(address);
    if (!token?.priceUsd || !this.ethUsd) return 0n;
    const fairTokens = (ethAmount * this.ethUsd) / token.priceUsd;
    const floor = fairTokens * 0.45;
    if (!Number.isFinite(floor) || floor <= 0) return 0n;
    return ethers.parseUnits(floor.toFixed(8), token.decimals ?? 18);
  }

  getMeta() {
    return {
      lastRefresh: this.lastRefresh,
      lastError: this.lastError,
      ethUsd: this.ethUsd,
      stockCount: this.lastStockCount,
      poolSize: this.tokens.size,
      tradableCount: this.list().filter((t) => t.tradable).length,
      sources: ['dexscreener', 'ondo', 'xstocks'],
    };
  }
}
