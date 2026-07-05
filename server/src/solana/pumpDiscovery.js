import { solanaConfig } from './config.js';

const API_BASE = 'https://frontend-api-v3.pump.fun';
const HEADERS = { Accept: 'application/json', Origin: 'https://pump.fun' };

function normalizeCoin(item) {
  const coin = item?.coin ?? item;
  if (!coin?.mint) return null;
  if (coin.complete === true || coin.is_banned) return null;
  return {
    mint: coin.mint,
    symbol: coin.symbol || '?',
    name: coin.name || coin.symbol || 'Unknown',
    usdMarketCap: Number(coin.usd_market_cap ?? coin.market_cap ?? 0) || 0,
    createdAt: Number(coin.created_timestamp ?? coin.created_at ?? 0) || 0,
    volatility: Number(coin.volatility_score ?? 0) || 0,
    source: 'pumpfun',
  };
}

export class PumpDiscovery {
  constructor() {
    /** @type {Map<string, { mint: string, symbol: string, name: string, usdMarketCap: number, source: string }>} */
    this.tokens = new Map();
    this.lastRefresh = 0;
    this.refreshing = false;
  }

  async refresh() {
    if (this.refreshing) return this.tokens.size;
    this.refreshing = true;
    try {
      const merged = new Map(this.tokens);

      const urls = [
        `${API_BASE}/coins/top-runners`,
      ];
      for (let offset = 0; offset < 300; offset += 100) {
        urls.push(`${API_BASE}/coins/recommended?limit=100&offset=${offset}&includeNsfw=false`);
      }

      for (const url of urls) {
        const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
        if (!res.ok) continue;
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.value ?? data.coins ?? []);
        for (const item of items) {
          const token = normalizeCoin(item);
          if (token) merged.set(token.mint, token);
        }
      }

      this.tokens = merged;
      this.lastRefresh = Date.now();
      const inBand = this.listInMcapRange().length;
      console.log(
        `[pump] ${merged.size} bonding-curve coins ready — ${inBand} near $${solanaConfig.targetMcapUsd} mcap ($${solanaConfig.mcapMinUsd}-$${solanaConfig.mcapMaxUsd})`,
      );
      return merged.size;
    } catch (err) {
      console.error('[pump] discovery refresh failed:', err.message);
      return this.tokens.size;
    } finally {
      this.refreshing = false;
    }
  }

  list() {
    return [...this.tokens.values()];
  }

  listInMcapRange(min = solanaConfig.mcapMinUsd, max = solanaConfig.mcapMaxUsd) {
    const target = solanaConfig.targetMcapUsd;
    return this.list()
      .filter((t) => t.usdMarketCap >= min && t.usdMarketCap <= max)
      .sort((a, b) => Math.abs(a.usdMarketCap - target) - Math.abs(b.usdMarketCap - target));
  }

  get(mint) {
    return this.tokens.get(mint);
  }

  symbolFor(mint) {
    const t = this.tokens.get(mint);
    return t ? `$${t.symbol}` : null;
  }
}
