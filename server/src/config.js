import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethereumMainnet } from './chain/ethereum.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

const speed = Math.max(0.1, Number(process.env.SHOW_SPEED) || 1);
const chainDefaults = ethereumMainnet;

function parseStockTokens(raw) {
  if (!raw) return chainDefaults.stockTokens;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through */
  }
  return chainDefaults.stockTokens;
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  databaseUrl: process.env.DATABASE_URL || '',
  openaiKey: process.env.OPENAI_API_KEY || '',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  geminiKey: process.env.GEMINI_API_KEY || '',
  contestantAiEnabled: process.env.ENABLE_CONTESTANT_AI === 'true',
  speed,
  // Ethereum mainnet
  chainId: Number(process.env.CHAIN_ID) || chainDefaults.chainId,
  chainName: process.env.CHAIN_NAME || chainDefaults.name,
  chainRpcUrl: process.env.EVM_RPC_URL || process.env.ETH_RPC_URL || chainDefaults.rpcUrl,
  chainExplorerUrl: process.env.CHAIN_EXPLORER_URL || chainDefaults.explorerUrl,
  nativeSymbol: process.env.NATIVE_SYMBOL || chainDefaults.nativeSymbol,
  wethAddress: process.env.WETH_ADDRESS || chainDefaults.weth,
  usdcAddress: process.env.USDC_ADDRESS || chainDefaults.usdc,
  uniswapV3Router: process.env.UNISWAP_V3_ROUTER || chainDefaults.uniswapV3Router,
  uniswapV3Quoter: process.env.UNISWAP_V3_QUOTER || chainDefaults.uniswapV3Quoter,
  uniswapV3Fee: Number(process.env.UNISWAP_V3_FEE) || chainDefaults.uniswapV3DefaultFee || 3000,
  stockTokens: parseStockTokens(process.env.STOCK_TOKENS_JSON),
  stockDiscoveryRefreshMs: Number(process.env.STOCK_DISCOVERY_REFRESH_MS) || 90_000,
  stockMinLiquidityUsd: Number(process.env.STOCK_MIN_LIQUIDITY_USD) || 1_000,
  /** Max time a bot holds a stock position before time-based exit. */
  botMaxHoldMs: Number(process.env.BOT_MAX_HOLD_MS) || 15 * 60_000,
  authServerKey: process.env.AUTH_SERVER_KEY || process.env.ENCRYPTION_KEY
    || (process.env.NODE_ENV !== 'production' ? 'local-dev-auth-key-32chars!!' : ''),
  encryptionKey: process.env.ENCRYPTION_KEY || process.env.AUTH_SERVER_KEY || '',
  simulationFallback: process.env.SIMULATION_FALLBACK === 'true',
  minEthForTrade: Number(process.env.MIN_ETH_FOR_TRADE) || 0.005,
  minEthForLaunch: Number(process.env.MIN_ETH_FOR_LAUNCH) || 0.01,
  maxTradesPerMinute: Number(process.env.MAX_TRADES_PER_MINUTE) || 30,
  tradeIntervalMs: Number(process.env.TRADE_INTERVAL_MS) || 2_000,
  balanceRefreshMs: Number(process.env.BALANCE_REFRESH_MS) || 5_000,
  tradeSellAfterBuyMs: Number(process.env.TRADE_SELL_AFTER_BUY_MS) || 20_000,
  tradeUsdPerSide: Number(process.env.TRADE_USD_PER_SIDE) || 2,
  ethUsdFallback: Number(process.env.ETH_USD_PRICE) || 2500,
  /** Default stock-bot buy size (~USD per swap). */
  botBuyUsd: Number(process.env.BOT_BUY_USD) || 15,
  /** ETH kept aside for gas on each buy/sell (Ethereum L1 is expensive). */
  botGasReserveEth: Number(process.env.BOT_GAS_RESERVE_ETH) || 0.005,
  // Legacy Solana island show (optional)
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  solanaNetwork: process.env.SOLANA_NETWORK || 'mainnet-beta',
  minSolForTrade: Number(process.env.MIN_SOL_FOR_TRADE) || 0.02,
  pumpExtraMints: (process.env.PUMP_EXTRA_MINTS || '').split(',').map((s) => s.trim()).filter(Boolean),
  pumpAutoLaunch: process.env.PUMP_AUTO_LAUNCH === 'true',
  pumpDiscoveryEnabled: process.env.PUMP_DISCOVERY !== 'false',
  pumpDiscoveryRefreshMs: Number(process.env.PUMP_DISCOVERY_REFRESH_MS) || 60_000,
  pumpTargetMcapUsd: Number(process.env.PUMP_TARGET_MCAP_USD) || 4_000,
  pumpMcapMinUsd: Number(process.env.PUMP_MCAP_MIN_USD) || 0,
  pumpMcapMaxUsd: Number(process.env.PUMP_MCAP_MAX_USD) || 0,
  phaseDurations: {
    interaction: Math.round(40_000 / speed),
    drama: Math.round(14_000 / speed),
    reaction: Math.round(26_000 / speed),
    voting: Math.round(35_000 / speed),
    outcome: Math.round(16_000 / speed),
    intermission: Math.round(8_000 / speed),
  },
};

export function chainConfig() {
  return {
    chainId: config.chainId,
    name: config.chainName,
    rpcUrl: config.chainRpcUrl,
    explorerUrl: config.chainExplorerUrl,
    weth: config.wethAddress,
    usdc: config.usdcAddress,
    uniswapV3Router: config.uniswapV3Router,
    uniswapV3Quoter: config.uniswapV3Quoter,
    uniswapV3Fee: config.uniswapV3Fee,
  };
}
