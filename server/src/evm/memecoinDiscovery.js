import { config } from '../config.js';
import { robinhoodMainnet } from '../chain/robinhood.js';

const DEX_BASE = 'https://api.dexscreener.com';
const WETH = robinhoodMainnet.weth.toLowerCase();

/** Official stock / stable tokens — not memecoins. */
const DENYLIST = new Set([
  WETH,
  ...robinhoodMainnet.stockTokens.map((t) => String(t.address).toLowerCase()),
  '0x5fc5360d0400a0fd4f2af552add042d716f1d168', // USDG
]);

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`DexScreener ${res.status}: ${url}`);
  return res.json();
}

function pickV2WethPair(pairs) {
  if (!Array.isArray(pairs)) return null;
  const eligible = pairs.filter((p) => {
    if (p.chainId !== 'robinhood') return false;
    if (String(p.quoteToken?.address || '').toLowerCase() !== WETH) return false;
    if (!Array.isArray(p.labels) || !p.labels.includes('v2')) return false;
    const liq = Number(p.liquidity?.usd ?? 0);
    return liq >= config.memecoinMinLiquidityUsd;
  });
  if (!eligible.length) return null;
  eligible.sort((a, b) => Number(b.liquidity?.usd ?? 0) - Number(a.liquidity?.usd ?? 0));
  return eligible[0];
}

function pairToToken(pair) {
  const base = pair.baseToken ?? {};
  const addr = String(base.address || '').toLowerCase();
  if (!addr || DENYLIST.has(addr)) return null;

  const mcap = Number(pair.marketCap ?? pair.fdv ?? 0);
  if (mcap <= 0) return null;

  const h1Change = Math.abs(Number(pair.priceChange?.h1 ?? 0));
  return {
    mint: addr,
    address: addr,
    symbol: String(base.symbol || 'MEME').slice(0, 16),
    name: base.name || base.symbol || 'Memecoin',
    usdMarketCap: mcap,
    priceUsd: Number(pair.priceUsd ?? 0),
    liquidityUsd: Number(pair.liquidity?.usd ?? 0),
    volatility: h1Change / 100,
    volumeH24: Number(pair.volume?.h24 ?? 0),
    pairAddress: pair.pairAddress,
    createdAt: Number(pair.pairCreatedAt ?? Date.now()),
    dexLabels: pair.labels ?? [],
  };
}

/** Live Robinhood Chain memecoin discovery via DexScreener (Uniswap V2 / WETH pairs). */
export class MemecoinDiscovery {
  constructor() {
    /** @type {Map<string, object>} */
    this.tokens = new Map();
    this.lastRefresh = 0;
    this.lastError = null;
    this.lastSourceCount = 0;
  }

  list() {
    return [...this.tokens.values()];
  }

  get(address) {
    return this.tokens.get(String(address).toLowerCase()) ?? null;
  }

  async collectCandidateAddresses() {
    const seen = new Set();
    const addrs = [];

    const push = (addr) => {
      const a = String(addr || '').toLowerCase();
      if (!a.startsWith('0x') || a.length !== 42 || DENYLIST.has(a) || seen.has(a)) return;
      seen.add(a);
      addrs.push(a);
    };

    for (const a of config.memecoinExtraAddresses) push(a);

    try {
      const profiles = await fetchJson(`${DEX_BASE}/token-profiles/latest/v1`);
      if (Array.isArray(profiles)) {
        for (const p of profiles) {
          if (p.chainId === 'robinhood') push(p.tokenAddress);
        }
      }
    } catch (err) {
      console.warn('[memecoin-discovery] profiles fetch failed:', err.message);
    }

    try {
      const boosts = await fetchJson(`${DEX_BASE}/token-boosts/latest/v1`);
      if (Array.isArray(boosts)) {
        for (const b of boosts) {
          if (b.chainId === 'robinhood') push(b.tokenAddress);
        }
      }
    } catch (err) {
      console.warn('[memecoin-discovery] boosts fetch failed:', err.message);
    }

    try {
      const topBoosts = await fetchJson(`${DEX_BASE}/token-boosts/top/v1`);
      if (Array.isArray(topBoosts)) {
        for (const b of topBoosts) {
          if (b.chainId === 'robinhood') push(b.tokenAddress);
        }
      }
    } catch (err) {
      console.warn('[memecoin-discovery] top boosts fetch failed:', err.message);
    }

    return addrs.slice(0, config.memecoinMaxCandidates);
  }

  async refresh() {
    const now = Date.now();
    if (now - this.lastRefresh < config.memecoinDiscoveryRefreshMs && this.tokens.size) return;

    this.lastError = null;
    const addresses = await this.collectCandidateAddresses();
    this.lastSourceCount = addresses.length;

    const found = new Map();
    const batchSize = 5;

    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      await Promise.all(batch.map(async (addr) => {
        try {
          const pairs = await fetchJson(`${DEX_BASE}/token-pairs/v1/robinhood/${addr}`);
          const best = pickV2WethPair(pairs);
          if (!best) return;
          const token = pairToToken(best);
          if (token) found.set(token.address, token);
        } catch (err) {
          /* skip individual token failures */
        }
      }));
    }

    this.tokens = found;
    this.lastRefresh = now;
    console.log(`[memecoin-discovery] ${found.size} tradable memecoins (v2/WETH) from ${addresses.length} candidates`);
  }

  getMeta() {
    return {
      lastRefresh: this.lastRefresh,
      lastError: this.lastError,
      sourceCandidates: this.lastSourceCount,
      poolSize: this.tokens.size,
    };
  }
}
