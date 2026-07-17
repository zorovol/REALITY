import { ethers } from 'ethers';
import { StockDiscovery } from '../src/evm/stockDiscovery.js';
import { TradingService } from '../src/evm/tradingService.js';
import { chainConfig } from '../src/config.js';

const d = new StockDiscovery();
await d.refresh();
const trading = new TradingService(chainConfig());

const tradable = d.list().filter((t) => t.tradable).sort((a, b) => b.usdMarketCap - a.usdMarketCap);
const value = ethers.parseEther('0.0014');

// funded EOA to simulate from
const res = await fetch('https://robinhoodchain.blockscout.com/api/v2/addresses');
const rich = (await res.json()).items?.find((a) => Number(a.coin_balance) > 1e18 && !a.is_contract);
console.log('simulating from', rich?.hash);

for (const t of tradable.slice(0, 5)) {
  const best = await trading.quoteBestPool(t.address, value, d.poolsFor(t.address), true);
  if (!best) { console.log(t.symbol, 'no quote'); continue; }
  const v4Input = trading.encodeV4Swap({
    tokenAddress: t.address,
    pool: best.pool,
    zeroForOne: true,
    amountIn: value,
    amountOutMin: (best.amountOut * 90n) / 100n,
  });
  const data = trading.router.interface.encodeFunctionData('execute', [
    '0x10', [v4Input], Math.floor(Date.now() / 1000) + 300,
  ]);
  try {
    await trading.provider.call({ from: rich.hash, to: trading.routerAddress, data, value });
    console.log(t.symbol, 'BUY SIM OK — quoted', ethers.formatUnits(best.amountOut, 18), t.symbol, 'fee', best.pool.fee);
  } catch (err) {
    console.log(t.symbol, 'BUY SIM REVERT:', (err.shortMessage || err.message).slice(0, 120));
  }
}
