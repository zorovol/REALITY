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
    source: 'pumpfun',
  };
}

export class PumpDiscovery {
  constructor() {
    /** @type {Map<string, { mint: string, symbol: string, name: string, source: string }>} */
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
        `${API_BASE}/coins/recommended?limit=50&offset=0&includeNsfw=false`,
        `${API_BASE}/coins/top-runners`,
      ];

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
      console.log(`[pump] ${merged.size} bonding-curve coins ready to trade`);
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

  get(mint) {
    return this.tokens.get(mint);
  }

  symbolFor(mint) {
    const t = this.tokens.get(mint);
    return t ? `$${t.symbol}` : null;
  }
}
