import { MemecoinDiscovery } from '../src/evm/memecoinDiscovery.js';
import { chainConfig } from '../src/config.js';
import { TradingService } from '../src/evm/tradingService.js';
import { defaultTradingRules, normalizeRules } from '../src/bots/strategies.js';

const rules = normalizeRules(defaultTradingRules());
const d = new MemecoinDiscovery();
await d.refresh();
const pool = d.list();
const inRange = pool.filter((t) => t.usdMarketCap >= rules.minMarketCap && t.usdMarketCap <= rules.maxMarketCap);

console.log('pool', pool.length, 'inRange', inRange.length, 'mcap band', rules.minMarketCap, '-', rules.maxMarketCap);
console.log('mcap sample', pool.slice(0, 5).map((t) => t.usdMarketCap));

const trading = new TradingService(chainConfig());
let routable = 0;
for (const t of inRange.slice(0, 30)) {
  if (await trading.canSwapEthForToken(t.address, rules.buyAmountEth)) routable++;
}
console.log('routable in first 30 in-range', routable);

const trading2 = new TradingService(chainConfig());
let routableAll = 0;
for (const t of pool.slice(0, 50)) {
  if (await trading2.canSwapEthForToken(t.address, rules.buyAmountEth)) routableAll++;
}
console.log('routable in first 50 pool (any mcap)', routableAll);

// with lowered min
const lowMin = pool.filter((t) => t.usdMarketCap >= 500 && t.usdMarketCap <= rules.maxMarketCap);
console.log('inRange if min=500', lowMin.length);
