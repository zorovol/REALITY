import { ethers } from 'ethers';
import { chainConfig } from '../src/config.js';

const chain = chainConfig();
const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId);

const V4_QUOTER = '0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94';
const QUOTER_ABI = [
  'function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData)) returns (uint256 amountOut,uint256 gasEstimate)',
];
const quoter = new ethers.Contract(V4_QUOTER, QUOTER_ABI, provider);

const ZERO = '0x0000000000000000000000000000000000000000';
const stocks = [
  ['AAPL', '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9'],
  ['TSLA', '0x322F0929c4625eD5bAd873c95208D54E1c003b2d'],
  ['NVDA', '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC'],
  ['MSFT', '0xe93237C50D904957Cf27E7B1133b510C669c2e74'],
  ['SPY', '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C'],
  ['GOOGL', '0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3'],
  ['SPCX', '0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa'],
  ['PLTR', '0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A'],
];

const combos = [
  [100, 1], [500, 10], [3000, 60], [10000, 200],
  // dynamic fee flag
  [0x800000, 60], [0x800000, 200],
];

const amountIn = ethers.parseEther('0.001'); // ~$3 of ETH

for (const [sym, addr] of stocks) {
  for (const [fee, tickSpacing] of combos) {
    try {
      const [out, gas] = await quoter.quoteExactInputSingle.staticCall({
        poolKey: { currency0: ZERO, currency1: addr, fee, tickSpacing, hooks: ZERO },
        zeroForOne: true,
        exactAmount: amountIn,
        hookData: '0x',
      });
      console.log(sym, 'fee', fee, 'ts', tickSpacing, '=>', ethers.formatUnits(out, 18), 'gas', gas.toString());
    } catch { /* no pool */ }
  }
}
console.log('done');
