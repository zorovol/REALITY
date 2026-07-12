import { ethers } from 'ethers';
import { config } from '../config.js';
import { robinhoodMainnet } from '../chain/robinhood.js';

const WETH = robinhoodMainnet.weth.toLowerCase();
const { apeStore, noxa } = robinhoodMainnet.launchpads;
const APE_PAGE_SIZE = 24;

/** Official stock / stable tokens — not memecoins. */
const DENYLIST = new Set([
  WETH,
  ...robinhoodMainnet.stockTokens.map((t) => String(t.address).toLowerCase()),
  '0x5fc5360d0400a0fd4f2af552add042d716f1d168', // USDG
]);

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

function normalizeToken(raw) {
  const addr = String(raw.address || raw.mint || '').toLowerCase();
  if (!addr.startsWith('0x') || addr.length !== 42 || DENYLIST.has(addr)) return null;

  const mcap = Number(raw.usdMarketCap ?? raw.marketCap ?? 0);
  if (!Number.isFinite(mcap) || mcap <= 0) return null;

  return {
    mint: addr,
    address: addr,
    symbol: String(raw.symbol || 'MEME').slice(0, 16),
    name: raw.name || raw.symbol || 'Memecoin',
    usdMarketCap: mcap,
    priceUsd: Number(raw.priceUsd ?? 0),
    liquidityUsd: Number(raw.liquidityUsd ?? 0),
    volatility: Number(raw.volatility ?? 0),
    volumeH24: Number(raw.volumeH24 ?? 0),
    launchpad: raw.launchpad,
    createdAt: Number(raw.createdAt ?? Date.now()),
  };
}

/** Paginate all Ape.Store Robinhood tokens (newest pages first, then keeps going). */
async function fetchApeStoreTokens(maxItems) {
  const found = [];
  const seen = new Set();
  const maxPages = config.memecoinApeMaxPages ?? 120;
  let page = 1;

  while (found.length < maxItems && page <= maxPages) {
    const url = `${apeStore.apiBase}?chain=${robinhoodMainnet.chainId}&page=${page}&pageSize=${APE_PAGE_SIZE}`;
    let data;
    try {
      data = await fetchJson(url);
    } catch (err) {
      console.warn(`[memecoin-discovery] ape.store page ${page} failed:`, err.message);
      break;
    }

    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) break;

    for (const item of items) {
      if (item.isDead) continue;
      const addr = String(item.address || '').toLowerCase();
      if (!addr || seen.has(addr)) continue;
      const token = normalizeToken({
        address: addr,
        symbol: item.symbol,
        name: item.name,
        marketCap: item.marketCap,
        launchpad: apeStore.name,
        createdAt: item.deployDate ? Date.parse(item.deployDate) : Date.now(),
      });
      if (token) {
        seen.add(addr);
        found.push(token);
      }
      if (found.length >= maxItems) break;
    }

    page += 1;
  }

  return found;
}

function parseNoxaLaunchLog(log) {
  if (String(log.topics?.[0] || '').toLowerCase() !== noxa.launchEventTopic.toLowerCase()) return null;
  if (!log.topics?.[2]) return null;
  const addr = ethers.getAddress(`0x${log.topics[2].slice(26)}`).toLowerCase();
  if (DENYLIST.has(addr)) return null;
  return {
    address: addr,
    launchpad: noxa.name,
    blockNumber: log.blockNumber ?? log.block_number,
    createdAt: log.block_timestamp ? Date.parse(log.block_timestamp) : Date.now(),
  };
}

async function fetchNoxaTokensFromBlockscout(maxItems) {
  const tokens = [];
  const seen = new Set();
  let next = `https://robinhoodchain.blockscout.com/api/v2/addresses/${noxa.factory}/logs`;
  let pages = 0;
  const maxPages = config.memecoinNoxaMaxPages ?? 40;

  while (next && tokens.length < maxItems && pages < maxPages) {
    let data;
    try {
      data = await fetchJson(next);
    } catch (err) {
      console.warn('[memecoin-discovery] noxa blockscout failed:', err.message);
      break;
    }

    for (const log of data.items ?? []) {
      const t = parseNoxaLaunchLog(log);
      if (!t || seen.has(t.address)) continue;
      seen.add(t.address);
      tokens.push(t);
      if (tokens.length >= maxItems) break;
    }

    if (data.next_page_params) {
      const params = new URLSearchParams(
        Object.entries(data.next_page_params).map(([k, v]) => [k, String(v)]),
      );
      next = `https://robinhoodchain.blockscout.com/api/v2/addresses/${noxa.factory}/logs?${params}`;
    } else {
      next = null;
    }
    pages += 1;
  }

  return tokens;
}

/** Chunked RPC log scan when Blockscout is unavailable. */
async function fetchNoxaTokensFromRpc(maxItems, seen = new Set()) {
  const tokens = [];
  const provider = new ethers.JsonRpcProvider(config.chainRpcUrl, config.chainId);
  const latest = await provider.getBlockNumber();
  const chunk = config.memecoinNoxaRpcChunkSize ?? 75_000;
  const maxChunks = config.memecoinNoxaMaxRpcChunks ?? 12;

  for (let i = 0; i < maxChunks && tokens.length < maxItems; i += 1) {
    const toBlock = latest - i * chunk;
    const fromBlock = Math.max(noxa.startBlock, toBlock - chunk + 1);
    if (fromBlock > toBlock) break;

    try {
      const logs = await provider.getLogs({
        address: noxa.factory,
        topics: [noxa.launchEventTopic],
        fromBlock: fromBlock,
        toBlock: toBlock,
      });
      for (const log of logs) {
        const t = parseNoxaLaunchLog(log);
        if (!t || seen.has(t.address)) continue;
        seen.add(t.address);
        tokens.push(t);
        if (tokens.length >= maxItems) break;
      }
    } catch (err) {
      console.warn(`[memecoin-discovery] noxa rpc ${fromBlock}-${toBlock}:`, err.message);
    }
  }

  return tokens;
}

async function enrichNoxaTokens(rawTokens) {
  const enriched = [];
  const provider = new ethers.JsonRpcProvider(config.chainRpcUrl, config.chainId);
  const erc20 = [
    'function symbol() view returns (string)',
    'function name() view returns (string)',
  ];

  for (const t of rawTokens) {
    let symbol = 'MEME';
    let name = 'Memecoin';
    try {
      const c = new ethers.Contract(t.address, erc20, provider);
      symbol = String(await c.symbol()).slice(0, 16);
      name = String(await c.name());
    } catch {
      /* use defaults */
    }
    const token = normalizeToken({
      address: t.address,
      symbol,
      name,
      marketCap: config.memecoinDefaultMcapUsd,
      launchpad: t.launchpad,
      createdAt: t.createdAt,
    });
    if (token) enriched.push(token);
  }

  return enriched;
}

async function fetchNoxaTokens(maxItems) {
  const seen = new Set();
  let raw = [];

  try {
    raw = await fetchNoxaTokensFromBlockscout(maxItems);
    raw.forEach((t) => seen.add(t.address));
  } catch (err) {
    console.warn('[memecoin-discovery] noxa blockscout unavailable:', err.message);
  }

  if (raw.length < maxItems) {
    const rpcTokens = await fetchNoxaTokensFromRpc(maxItems - raw.length, seen);
    raw = [...raw, ...rpcTokens];
  }

  return enrichNoxaTokens(raw);
}

/** Live Robinhood Chain memecoins — Ape.Store + NOXA Fun launchpads only. */
export class MemecoinDiscovery {
  constructor() {
    /** @type {Map<string, object>} */
    this.tokens = new Map();
    this.lastRefresh = 0;
    this.lastError = null;
    this.lastSourceCount = 0;
    this.lastApeCount = 0;
    this.lastNoxaCount = 0;
  }

  list() {
    return [...this.tokens.values()];
  }

  get(address) {
    return this.tokens.get(String(address).toLowerCase()) ?? null;
  }

  async refresh() {
    const now = Date.now();
    if (now - this.lastRefresh < config.memecoinDiscoveryRefreshMs && this.tokens.size) return;

    this.lastError = null;
    const max = config.memecoinMaxCandidates;

    const [apeTokens, noxaTokens] = await Promise.all([
      fetchApeStoreTokens(max),
      fetchNoxaTokens(max),
    ]);

    this.lastApeCount = apeTokens.length;
    this.lastNoxaCount = noxaTokens.length;
    this.lastSourceCount = apeTokens.length + noxaTokens.length;

    const merged = new Map();
    for (const t of [...apeTokens, ...noxaTokens]) {
      const existing = merged.get(t.address);
      if (!existing || t.usdMarketCap > existing.usdMarketCap) {
        merged.set(t.address, t);
      }
    }

    for (const addr of config.memecoinExtraAddresses) {
      const a = String(addr).toLowerCase();
      if (!merged.has(a) && !DENYLIST.has(a)) {
        const token = normalizeToken({
          address: a,
          symbol: 'EXTRA',
          name: 'Extra',
          marketCap: config.memecoinDefaultMcapUsd,
          launchpad: 'manual',
        });
        if (token) merged.set(a, token);
      }
    }

    this.tokens = merged;
    this.lastRefresh = now;
    console.log(
      `[memecoin-discovery] ${merged.size} launchpad memecoins `
      + `(ape.store: ${apeTokens.length}, noxa: ${noxaTokens.length})`,
    );
  }

  getMeta() {
    return {
      lastRefresh: this.lastRefresh,
      lastError: this.lastError,
      sourceCandidates: this.lastSourceCount,
      apeStoreCount: this.lastApeCount,
      noxaCount: this.lastNoxaCount,
      poolSize: this.tokens.size,
      sources: ['ape.store', 'noxa'],
    };
  }
}
