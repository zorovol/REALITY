import { ethers } from 'ethers';
import { chainConfig } from '../src/config.js';

const chain = chainConfig();
const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId);

const V2_ABI = ['function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] memory amounts)'];
const QUOTER_ABI = ['function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160,uint32,uint256)'];

const v2 = new ethers.Contract(chain.uniswapV2Router, V2_ABI, provider);
const quoter = new ethers.Contract(chain.uniswapV3Quoter, QUOTER_ABI, provider);

const stocks = [
  ['AAPL', '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9'],
  ['NVDA', '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC'],
  ['TSLA', '0x322F0929c4625eD5bAd873c95208D54E1c003b2d'],
  ['SPY', '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C'],
  ['MSFT', '0xe93237C50D904957Cf27E7B1133b510C669c2e74'],
  ['PLTR', '0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A'],
  ['GOOGL', '0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3'],
  ['SPCX', '0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa'],
];

const USDG = '0x5fc5360D04c8D9107B21f4CA1c74dC2b8Bfe674c'.toLowerCase();
const amountIn = ethers.parseEther('0.001');

// First: does WETH->USDG work?
for (const fee of [500, 3000, 10000]) {
  try {
    const out = await quoter.quoteExactInputSingle.staticCall({
      tokenIn: chain.weth, tokenOut: USDG, amountIn, fee, sqrtPriceLimitX96: 0,
    });
    console.log('WETH->USDG fee', fee, '=>', ethers.formatUnits(out[0], 6), '(6dp) /', ethers.formatUnits(out[0], 18), '(18dp)');
  } catch { console.log('WETH->USDG fee', fee, 'no pool'); }
}
try {
  const amounts = await v2.getAmountsOut(amountIn, [chain.weth, USDG]);
  console.log('WETH->USDG v2 =>', amounts[1].toString());
} catch { console.log('WETH->USDG v2 no pool'); }

// Then: USDG -> stock (try both 6 and 18 decimals for USDG amount)
const usdgIn = 10n ** 6n * 3n; // $3 if 6dp
const usdgIn18 = 10n ** 18n * 3n;
for (const [sym, addr] of stocks) {
  for (const fee of [500, 3000, 10000]) {
    for (const [label, amt] of [['6dp', usdgIn], ['18dp', usdgIn18]]) {
      try {
        const out = await quoter.quoteExactInputSingle.staticCall({
          tokenIn: USDG, tokenOut: addr, amountIn: amt, fee, sqrtPriceLimitX96: 0,
        });
        console.log(sym, 'USDG fee', fee, label, '=>', ethers.formatUnits(out[0], 18));
      } catch { /* skip */ }
    }
  }
  try {
    const amounts = await v2.getAmountsOut(usdgIn, [USDG, addr]);
    console.log(sym, 'USDG v2 =>', ethers.formatUnits(amounts[1], 18));
  } catch { /* skip */ }
}
console.log('done');
