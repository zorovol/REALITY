import { ethers } from 'ethers';
import { robinhoodMainnet } from '../src/chain/robinhood.js';
import { config } from '../src/config.js';

const { noxa } = robinhoodMainnet.launchpads;
const provider = new ethers.JsonRpcProvider(config.chainRpcUrl, config.chainId);
const latest = await provider.getBlockNumber();
const logs = await provider.getLogs({
  address: noxa.factory,
  topics: [noxa.launchEventTopic],
  fromBlock: noxa.startBlock,
  toBlock: latest,
});
console.log('noxa rpc logs', logs.length, 'latest', latest);
if (logs.length) {
  const addr = ethers.getAddress('0x' + logs[0].topics[2].slice(26));
  console.log('oldest token sample', addr, 'block', logs[0].blockNumber);
  const addr2 = ethers.getAddress('0x' + logs[logs.length - 1].topics[2].slice(26));
  console.log('newest token sample', addr2, 'block', logs[logs.length - 1].blockNumber);
}
