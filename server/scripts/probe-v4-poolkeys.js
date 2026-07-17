import { ethers } from 'ethers';
import { chainConfig } from '../src/config.js';

const chain = chainConfig();
const provider = new ethers.JsonRpcProvider(chain.rpcUrl, chain.chainId);

const POOL_MANAGER = '0x8366a39CC670B4001A1121B8F6A443A643e40951';
const INIT_TOPIC = ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');

const stocks = [
  ['AAPL', '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9'],
  ['TSLA', '0x322F0929c4625eD5bAd873c95208D54E1c003b2d'],
  ['NVDA', '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC'],
  ['MSFT', '0xe93237C50D904957Cf27E7B1133b510C669c2e74'],
];

const latest = await provider.getBlockNumber();
console.log('latest block', latest);

const coder = ethers.AbiCoder.defaultAbiCoder();

for (const [sym, addr] of stocks) {
  const topicAddr = ethers.zeroPadValue(addr, 32);
  // token can be currency0 or currency1 depending on sort order
  for (const pos of [2, 3]) {
    const topics = [INIT_TOPIC, null, null, null];
    topics[pos] = topicAddr;
    try {
      const logs = await provider.getLogs({
        address: POOL_MANAGER,
        fromBlock: 0,
        toBlock: latest,
        topics,
      });
      for (const log of logs) {
        const c0 = ethers.getAddress('0x' + log.topics[2].slice(26));
        const c1 = ethers.getAddress('0x' + log.topics[3].slice(26));
        const [fee, tickSpacing, hooks] = coder.decode(['uint24', 'int24', 'address', 'uint160', 'int24'], log.data);
        console.log(sym, 'pool id', log.topics[1].slice(0, 18), '| c0', c0, '| c1', c1, '| fee', fee.toString(), '| ts', tickSpacing.toString(), '| hooks', hooks);
      }
    } catch (err) {
      console.log(sym, 'pos', pos, 'getLogs failed:', err.message.slice(0, 120));
    }
  }
}
console.log('done');
