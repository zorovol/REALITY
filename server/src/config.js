import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from repo root first, then server/ (server wins if both exist)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

const speed = Math.max(0.1, Number(process.env.SHOW_SPEED) || 1);

const network = process.env.SOLANA_NETWORK || 'mainnet-beta';
const defaultRpc = network === 'devnet'
  ? 'https://api.devnet.solana.com'
  : 'https://api.mainnet-beta.solana.com';

export const config = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  databaseUrl: process.env.DATABASE_URL || '',
  openaiKey: process.env.OPENAI_API_KEY || '',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  geminiKey: process.env.GEMINI_API_KEY || '',
  contestantAiEnabled: process.env.ENABLE_CONTESTANT_AI === 'true',
  speed,
  // Solana / pump.fun (real on-chain trading)
  solanaRpcUrl: process.env.SOLANA_RPC_URL || defaultRpc,
  solanaNetwork: network,
  authServerKey: process.env.AUTH_SERVER_KEY || process.env.ENCRYPTION_KEY
    || (process.env.NODE_ENV !== 'production' ? 'local-dev-auth-key-32chars!!' : ''),
  simulationFallback: process.env.SIMULATION_FALLBACK === 'true',
  minSolForTrade: Number(process.env.MIN_SOL_FOR_TRADE) || 0.02,
  minSolForLaunch: Number(process.env.MIN_SOL_FOR_LAUNCH) || 0.2,
  maxTradesPerMinute: Number(process.env.MAX_TRADES_PER_MINUTE) || 30,
  tradeIntervalMs: Number(process.env.TRADE_INTERVAL_MS) || 2_000,
  balanceRefreshMs: Number(process.env.BALANCE_REFRESH_MS) || 5_000,
  tradeSellAfterBuyMs: Number(process.env.TRADE_SELL_AFTER_BUY_MS) || 20_000,
  tradeUsdPerSide: Number(process.env.TRADE_USD_PER_SIDE) || 2,
  solUsdFallback: Number(process.env.SOL_USD_PRICE) || 150,
  pumpExtraMints: (process.env.PUMP_EXTRA_MINTS || '').split(',').map((s) => s.trim()).filter(Boolean),
  pumpAutoLaunch: process.env.PUMP_AUTO_LAUNCH === 'true',
  pumpDiscoveryEnabled: process.env.PUMP_DISCOVERY !== 'false',
  pumpDiscoveryRefreshMs: Number(process.env.PUMP_DISCOVERY_REFRESH_MS) || 60_000,
  pumpTargetMcapUsd: Number(process.env.PUMP_TARGET_MCAP_USD) || 4_000,
  pumpMcapMinUsd: Number(process.env.PUMP_MCAP_MIN_USD) || 0,
  pumpMcapMaxUsd: Number(process.env.PUMP_MCAP_MAX_USD) || 0,
  // Phase durations in ms (divided by speed multiplier)
  phaseDurations: {
    interaction: Math.round(40_000 / speed),
    drama: Math.round(14_000 / speed),
    reaction: Math.round(26_000 / speed),
    voting: Math.round(35_000 / speed),
    outcome: Math.round(16_000 / speed),
    intermission: Math.round(8_000 / speed),
  },
};
