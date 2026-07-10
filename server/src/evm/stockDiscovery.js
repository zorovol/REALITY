import { config } from '../config.js';

/** Discovers tokenized stocks on Robinhood Chain for bot selection. */
export class StockDiscovery {
  constructor() {
    /** @type {Map<string, object>} */
    this.tokens = new Map();
    this.lastRefresh = 0;
  }

  list() {
    return [...this.tokens.values()];
  }

  get(address) {
    return this.tokens.get(String(address).toLowerCase()) ?? null;
  }

  async refresh() {
    const now = Date.now();
    if (now - this.lastRefresh < config.stockDiscoveryRefreshMs && this.tokens.size) return;

    const pool = config.stockTokens.map((t) => {
      const addr = String(t.address).toLowerCase();
      const priceUsd = Number(t.priceUsd) || 100;
      return {
        mint: addr,
        address: addr,
        symbol: t.symbol || 'STOCK',
        priceUsd,
        usdMarketCap: priceUsd * 1_000_000,
        volatility: Math.random() * 0.5 + 0.2,
        createdAt: t.createdAt ?? now,
      };
    });

    this.tokens.clear();
    for (const t of pool) this.tokens.set(t.address, t);
    this.lastRefresh = now;
  }
}
