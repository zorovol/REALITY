import { StockDiscovery } from '../src/evm/stockDiscovery.js';
import { TradingService } from '../src/evm/tradingService.js';
import { chainConfig } from '../src/config.js';
import { defaultTradingRules, normalizeRules, buildTradeCandidateOrder } from '../src/bots/strategies.js';

const d = new StockDiscovery();
await d.refresh();
const pool = d.list();
console.log('stocks discovered:', pool.length);

const tradable = pool.filter((t) => t.tradable);
console.log('tradable (native V4 pool):', tradable.length);
console.log(tradable.slice(0, 15).map((t) => `${t.symbol} $${t.priceUsd} mcap$${Math.round(t.usdMarketCap)} pools:${t.pools.length}`).join('\n'));

const rules = normalizeRules(defaultTradingRules());
console.log('\ndefault rules:', rules);
const inRange = tradable.filter((t) => t.usdMarketCap >= rules.minMarketCap && t.usdMarketCap <= rules.maxMarketCap);
console.log('in mcap range:', inRange.length);

const trading = new TradingService(chainConfig());
const ordered = buildTradeCandidateOrder('gemini', inRange);
console.log('ethUsd used for fair-price guard:', d.ethUsd);
let routable = 0;
const routableSymbols = [];
for (const t of ordered.slice(0, 20)) {
  const minOut = d.minOutForBuy(t.address, rules.buyAmountEth);
  const ok = await trading.canSwapEthForToken(t.address, rules.buyAmountEth, d.poolsFor(t.address), minOut);
  if (ok) { routable += 1; routableSymbols.push(t.symbol); }
}
console.log('routable+fair of first 20 (gemini order):', routable, '→', routableSymbols.join(', '));
