import { ethers } from 'ethers';
import { config } from '../config.js';
import { robinhoodMainnet } from '../chain/robinhood.js';

const WETH = robinhoodMainnet.weth.toLowerCase();
const { apeStore, noxa } = robinhoodMainnet.launchpads;

/** Official stock / stable tokens — not memecoins. */
const DENYLIST = new Set([
  WETH,
  ...robinhoodMainnet.stockTokens.map((t) => String(t.address).toLowerCase()),
  '0x5fc5360d0400a0fd4f2af552add042d716f1d168', // USDG
]);

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
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

/** Paginate Ape.Store Robinhood chain tokens. */
async function fetchApeStoreTokens(maxItems) {
  const found = [];
  const pageSize = 100;
  let page = 1;

  while (found.length < maxItems && page <= 50) {
    const url = `${apeStore.apiBase}?chain=${robinhoodMainnet.chainId}&page=${page}&pageSize=${pageSize}`;
    let data;
    try {
      data = await fetchJson(url);
    } catch (err) {
      console.warn('[memecoin-discovery] ape.store fetch failed:', err.message);
      break;
    }

    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) break;

    for (const item of items) {
      if (item.isDead) continue;
      const token = normalizeToken({
        address: item.address,
        symbol: item.symbol,
        name: item.name,
        marketCap: item.marketCap,
        launchpad: apeStore.name,
        createdAt: item.deployDate ? Date.parse(item.deployDate) : Date.now(),
      });
      if (token) found.push(token);
      if (found.length >= maxItems) break;
    }

    if (items.length < pageSize) break;
    page += 1;
  }

  return found;
}

/** Index NOXA Fun launches from factory event logs (Blockscout). */
async function fetchNoxaTokens(maxItems) {
  const tokens = [];
  const seen = new Set();
  let next = `https://robinhoodchain.blockscout.com/api/v2/addresses/${noxa.factory}/logs`;
  let pages = 0;

  while (next && tokens.length < maxItems && pages < 20) {
    let data;
    try {
      data = await fetchJson(next);
    } catch (err) {
      console.warn('[memecoin-discovery] noxa logs fetch failed:', err.message);
      break;
    }

    for (const log of data.items ?? []) {
      if (String(log.topics?.[0] || '').toLowerCase() !== noxa.launchEventTopic.toLowerCase()) continue;
      const addr = ethers.getAddress(`0x${log.topics[2].slice(26)}`).toLowerCase();
      if (DENYLIST.has(addr) || seen.has(addr)) continue;
      seen.add(addr);
      tokens.push({
        address: addr,
        launchpad: noxa.name,
        blockNumber: log.block_number,
        createdAt: log.block_timestamp ? Date.parse(log.block_timestamp) : Date.now(),
      });
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

  // Enrich NOXA tokens with on-chain symbol/name; mcap from Ape-style default if unknown.
  const enriched = [];
  const provider = new ethers.JsonRpcProvider(config.chainRpcUrl, config.chainId);
  const erc20 = [
    'function symbol() view returns (string)',
    'function name() view returns (string)',
  ];

  for (const t of tokens) {
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
