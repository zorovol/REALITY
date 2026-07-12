import { MemecoinDiscovery } from '../src/evm/memecoinDiscovery.js';

const d = new MemecoinDiscovery();
await d.refresh();
const list = d.list();
console.log('meta', d.getMeta());
console.log('sample', list.slice(0, 5).map((t) => ({ symbol: t.symbol, launchpad: t.launchpad, mcap: Math.round(t.usdMarketCap) })));
console.log('launchpads', {
  ape: list.filter((t) => t.launchpad === 'ape.store').length,
  noxa: list.filter((t) => t.launchpad === 'noxa').length,
});
