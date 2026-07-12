import { chainConfig } from '../src/config.js';
import { TradingService } from '../src/evm/tradingService.js';

const trading = new TradingService(chainConfig());
const token = '0x02fafc57f534b33d877cd01a0d0de333a8ff5e96'; // ape.store HHH
const ok = await trading.canSwapEthForToken(token, 0.001);
console.log('HHH routable', ok);
if (ok) {
  const out = await trading.quoteEthForToken(token, 0.001);
  console.log('quote tokens', out.toString());
}
