import { ethers } from 'ethers';
import { chainConfig } from '../src/config.js';

const chain = chainConfig();
const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId);

const UNIVERSAL_ROUTER = '0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77';
const ZERO = '0x0000000000000000000000000000000000000000';
const AAPL = '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9';

const UR_ABI = ['function execute(bytes commands, bytes[] inputs, uint256 deadline) payable'];
const ur = new ethers.Contract(UNIVERSAL_ROUTER, UR_ABI, provider);
const coder = ethers.AbiCoder.defaultAbiCoder();

// AAPL native pools seen in Initialize logs: fee 50000/ts 1000 and 30000/ts 600
const poolKey = [ZERO, AAPL, 50000, 1000, ZERO];
const amountIn = ethers.parseEther('0.0005');

const V4_SWAP = '0x10';
const actions = '0x060c0f'; // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL

const swapParams = coder.encode(
  ['tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)'],
  [[poolKey, true, amountIn, 0n, '0x']],
);
const settleParams = coder.encode(['address', 'uint256'], [ZERO, amountIn]);
const takeParams = coder.encode(['address', 'uint256'], [AAPL, 0n]);
const v4Input = coder.encode(['bytes', 'bytes[]'], [actions, [swapParams, settleParams, takeParams]]);

const deadline = Math.floor(Date.now() / 1000) + 600;
const data = ur.interface.encodeFunctionData('execute', [V4_SWAP, [v4Input], deadline]);

// find a funded address to simulate from
const res = await fetch('https://robinhoodchain.blockscout.com/api/v2/addresses');
const rich = (await res.json()).items?.find((a) => Number(a.coin_balance) > 1e18 && !a.is_contract);
const from = rich?.hash || '0x0000000000000000000000000000000000000001';
console.log('simulating from', from, 'balance', rich?.coin_balance);

try {
  const result = await provider.call({ from, to: UNIVERSAL_ROUTER, data, value: amountIn });
  console.log('SUCCESS eth_call result:', result.slice(0, 80));
} catch (err) {
  console.log('REVERT:', err.shortMessage || err.message, '| data:', err.data ?? err.info?.error?.data ?? 'none');
}
