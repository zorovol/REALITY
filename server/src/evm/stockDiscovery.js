import { ethers } from 'ethers';
import { config } from '../config.js';
import { robinhoodMainnet } from '../chain/robinhood.js';

const BLOCKSCOUT = `${robinhoodMainnet.explorerUrl}/api/v2`;
const POOL_MANAGER = robinhoodMainnet.uniswapV4.poolManager;
const INIT_TOPIC = ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const ZERO_TOPIC = ethers.zeroPadValue(ZERO_ADDR, 32);

async function fetchJson(url, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i += 1) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return res.json();
    } catch (err) {
      lastErr = err;
      if (i < retries) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

/** Live ETH/USD from Blockscout chain stats. */
async function fetchEthUsd() {
  const stats = await fetchJson(`${BLOCKSCOUT}/stats`);
  const price = Number(stats?.coin_price);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

/** All Robinhood tokenized stocks/ETFs from Blockscout (name ends "Robinhood Token"). */
async function fetchStockTokens() {
  const found = [];
  const seen = new Set();
  let next = `${BLOCKSCOUT}/tokens?q=${encodeURIComponent('Robinhood Token')}`;
  let pages = 0;
  const maxPages = config.stockMaxPages;

  while (next && pages < maxPages) {
    const data = await fetchJson(next);
    for (const item of data.items ?? []) {
      const addr = String(item.address_hash || item.address || '').toLowerCase();
      const name = String(item.name || '');
      if (!addr.startsWith('0x') || seen.has(addr)) continue;
      if (!/robinhood token/i.test(name)) continue;
      seen.add(addr);
      found.push({
        mint: addr,
        address: addr,
        symbol: String(item.symbol || 'STOCK').slice(0, 16),
        name: name.replace(/\s*[•·]\s*Robinhood Token\s*$/i, '').trim() || item.symbol,
        priceUsd: Number(item.exchange_rate) || 0,
        usdMarketCap: Number(item.circulating_market_cap) || 0,
        volumeH24: Number(item.volume_24h) || 0,
        holders: Number(item.holders_count) || 0,
        decimals: Number(item.decimals) || 18,
      });
    }
    if (data.next_page_params) {
      const params = new URLSearchParams(
        Object.entries(data.next_page_params).map(([k, v]) => [k, String(v)]),
      );
      next = `${BLOCKSCOUT}/tokens?q=${encodeURIComponent('Robinhood Token')}&${params}`;
    } else {
      next = null;
    }
    pages += 1;
  }
  return found;
}

/** Scan V4 PoolManager Initialize logs for native-ETH pools (currency0 = 0x0). */
async function fetchNativePoolKeys(provider) {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const latest = await provider.getBlockNumber();
  /** token address -> [{fee, tickSpacing}] (hookless pools only) */
  const pools = new Map();

  const collect = (logs) => {
    for (const log of logs) {
      const token = `0x${log.topics[3].slice(26)}`.toLowerCase();
      const [fee, tickSpacing, hooks] = coder.decode(
        ['uint24', 'int24', 'address', 'uint160', 'int24'],
        log.data,
      );
      if (hooks.toLowerCase() !== ZERO_ADDR) continue;
      if (!pools.has(token)) pools.set(token, []);
      pools.get(token).push({ fee: Number(fee), tickSpacing: Number(tickSpacing) });
    }
  };

  const filter = { address: POOL_MANAGER, topics: [INIT_TOPIC, null, ZERO_TOPIC] };

  // Halve the range on RPC log-limit errors until each request fits.
  const scan = async (from, to, depth = 0) => {
    try {
      collect(await provider.getLogs({ ...filter, fromBlock: from, toBlock: to }));
    } catch (err) {
      if (depth < 8 && to > from) {
        const mid = Math.floor((from + to) / 2);
        await scan(from, mid, depth + 1);
        await scan(mid + 1, to, depth + 1);
      } else {
        console.warn(`[rwa-discovery] pool scan ${from}-${to} failed:`, err.message.slice(0, 120));
      }
    }
  };

  const chunk = config.stockPoolScanChunk;
  for (let from = 0; from <= latest; from += chunk) {
    await scan(from, Math.min(from + chunk - 1, latest));
  }
  return pools;
}

/** Discovers Robinhood tokenized stocks (RWAs) with live Uniswap V4 ETH pools. */
export class StockDiscovery {
  constructor() {
    /** @type {Map<string, object>} */
    this.tokens = new Map();
    /** token address -> candidate native pool keys (cached across refreshes) */
    this.poolKeys = new Map();
    this.lastRefresh = 0;
    this.lastPoolScan = 0;
    this.lastError = null;
    this.lastStockCount = 0;
    this.ethUsd = config.ethUsdFallback;
    this.provider = new ethers.JsonRpcProvider(config.chainRpcUrl, config.chainId);
  }

  list() {
    return [...this.tokens.values()];
  }

  get(address) {
    return this.tokens.get(String(address).toLowerCase()) ?? null;
  }

  poolsFor(address) {
    return this.poolKeys.get(String(address).toLowerCase()) ?? [];
  }

  async refresh() {
    const now = Date.now();
    if (now - this.lastRefresh < config.stockDiscoveryRefreshMs && this.tokens.size) return;
    this.lastError = null;

    try {
      const price = await fetchEthUsd();
      if (price) this.ethUsd = price;
    } catch {
      /* keep last known ETH price */
    }

    let stocks = [];
    try {
      stocks = await fetchStockTokens();
    } catch (err) {
      this.lastError = err.message;
      console.warn('[rwa-discovery] blockscout stock list failed:', err.message);
      if (!this.tokens.size) return;
    }
    this.lastStockCount = stocks.length;

    // Pool scan is expensive — redo at most every 30 min.
    if (now - this.lastPoolScan > config.stockPoolScanRefreshMs || !this.poolKeys.size) {
      try {
        this.poolKeys = await fetchNativePoolKeys(this.provider);
        this.lastPoolScan = now;
      } catch (err) {
        console.warn('[rwa-discovery] V4 pool scan failed:', err.message);
      }
    }

    if (stocks.length) {
      const merged = new Map();
      for (const s of stocks) {
        const pools = this.poolKeys.get(s.address) ?? [];
        merged.set(s.address, {
          ...s,
          pools,
          tradable: pools.length > 0 && s.priceUsd > 0,
          // turnover ratio as a volatility-style signal for ranking
          volatility: s.usdMarketCap > 0 ? s.volumeH24 / s.usdMarketCap : 0,
        });
      }
      this.tokens = merged;
    }
    this.lastRefresh = now;

    const tradable = this.list().filter((t) => t.tradable).length;
    console.log(`[rwa-discovery] ${this.tokens.size} Robinhood stock tokens, ${tradable} with native V4 ETH pools`);
  }

  /**
   * Minimum acceptable token output for an ETH buy — half of fair value at
   * the stock's real price. Filters out dead/mispriced V4 pools.
   */
  minOutForBuy(address, ethAmount) {
    const token = this.get(address);
    if (!token?.priceUsd || !this.ethUsd) return 0n;
    const fairTokens = (ethAmount * this.ethUsd) / token.priceUsd;
    const floor = fairTokens * 0.5;
    if (!Number.isFinite(floor) || floor <= 0) return 0n;
    return ethers.parseUnits(floor.toFixed(Math.min(token.decimals ?? 18, 18)), token.decimals ?? 18);
  }

  getMeta() {
    return {
      lastRefresh: this.lastRefresh,
      lastError: this.lastError,
      ethUsd: this.ethUsd,
      stockCount: this.lastStockCount,
      poolSize: this.tokens.size,
      tradableCount: this.list().filter((t) => t.tradable).length,
      sources: ['robinhood-chain-blockscout', 'uniswap-v4'],
    };
  }
}
