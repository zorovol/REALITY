import { ethers } from 'ethers';
import { StockDiscovery } from '../src/evm/stockDiscovery.js';
import { TradingService } from '../src/evm/tradingService.js';
import { chainConfig } from '../src/config.js';

const d = new StockDiscovery();
await d.refresh();
const trading = new TradingService(chainConfig());
const t = d.list().filter((x) => x.tradable).sort((a, b) => b.liquidityUsd - a.liquidityUsd)[0];
const ethAmount = 0.01;
const value = ethers.parseEther(String(ethAmount));
const best = await trading.quoteBest(t.address, value, d.poolsFor(t.address), true);
console.log('target', t.symbol, t.address, 'route', best?.routeType, 'fee', best?.fee);

const router = trading.router;
const deadline = Math.floor(Date.now() / 1000) + 300;
const amountOutMin = (best.amountOut * 90n) / 100n;
let data;
if (best.routeType === 'weth') {
  data = router.interface.encodeFunctionData('exactInputSingle', [{
    tokenIn: trading.weth, tokenOut: t.address, fee: best.fee,
    recipient: '0x38d2999f3E2b0D4543A7c4ba41d52ED634423866',
    amountIn: value, amountOutMinimum: amountOutMin, sqrtPriceLimitX96: 0n,
  }]);
} else {
  data = router.interface.encodeFunctionData('exactInput', [{
    path: best.path, recipient: '0x38d2999f3E2b0D4543A7c4ba41d52ED634423866',
    amountIn: value, amountOutMinimum: amountOutMin,
  }]);
}
const multicall = router.interface.encodeFunctionData('multicall', [deadline, [data]]);
try {
  await trading.provider.call({
    from: '0x38d2999f3E2b0D4543A7c4ba41d52ED634423866',
    to: trading.chain.uniswapV3Router,
    data: multicall,
    value,
  });
  console.log('BUY SIM OK', t.symbol);
} catch (err) {
  console.log('BUY SIM REVERT', err.shortMessage || err.message);
}
