import { StockDiscovery } from '../src/evm/stockDiscovery.js';
import { TradingService } from '../src/evm/tradingService.js';
import { chainConfig } from '../src/config.js';
import { defaultTradingRules, normalizeRules, buildTradeCandidateOrder } from '../src/bots/strategies.js';
import { ethers } from 'ethers';

const d = new StockDiscovery();
await d.refresh();
const pool = d.list();
const tradable = pool.filter((t) => t.tradable);
console.log('stocks', pool.length, 'tradable', tradable.length);
console.log(tradable.slice(0, 12).map((t) => `${t.symbol} $${t.priceUsd} liq$${Math.round(t.liquidityUsd)} via ${t.routeType}`).join('\n'));

const rules = normalizeRules(defaultTradingRules());
console.log('rules', rules, 'ethUsd', d.ethUsd);

const trading = new TradingService(chainConfig());
const ordered = buildTradeCandidateOrder('gemini', tradable);
let ok = 0;
const syms = [];
for (const t of ordered.slice(0, 12)) {
  const minOut = d.minOutForBuy(t.address, rules.buyAmountEth);
  const can = await trading.canSwapEthForToken(t.address, rules.buyAmountEth, d.poolsFor(t.address), minOut);
  if (can) { ok += 1; syms.push(t.symbol); }
}
console.log('routable+fair', ok, '→', syms.join(', '));

// simulate buy eth_call for first routable
if (syms.length) {
  const t = ordered.find((x) => x.symbol === syms[0]);
  const value = ethers.parseEther(String(rules.buyAmountEth));
  const best = await trading.quoteBest(t.address, value, d.poolsFor(t.address), true);
  console.log('best quote', t.symbol, best?.routeType, 'out', best ? ethers.formatUnits(best.amountOut, 18) : null);
}
