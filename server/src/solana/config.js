import { config } from '../config.js';

export const LAMPORTS_PER_SOL = 1_000_000_000;

export const solanaConfig = {
  rpcUrl: config.solanaRpcUrl,
  network: config.solanaNetwork,
  simulationFallback: config.simulationFallback,
  encryptionKey: config.encryptionKey,
  minSolForTrade: config.minSolForTrade,
  minSolForLaunch: config.minSolForLaunch,
  maxTradesPerMinute: config.maxTradesPerMinute,
  tradeIntervalMs: config.tradeIntervalMs,
  balanceRefreshMs: config.balanceRefreshMs,
  extraMints: config.pumpExtraMints,
  autoLaunch: config.pumpAutoLaunch,
  discoveryEnabled: config.pumpDiscoveryEnabled,
  discoveryRefreshMs: config.pumpDiscoveryRefreshMs,
  targetMcapUsd: config.pumpTargetMcapUsd,
  mcapMinUsd: config.pumpMcapMinUsd || Math.round(config.pumpTargetMcapUsd * 0.625),
  mcapMaxUsd: config.pumpMcapMaxUsd || Math.round(config.pumpTargetMcapUsd * 1.5),
  tradeUsdPerSide: config.tradeUsdPerSide,
  solUsdFallback: config.solUsdFallback,
};

export function solscanTxUrl(signature) {
  if (config.solanaNetwork === 'mainnet-beta') {
    return `https://solscan.io/tx/${signature}`;
  }
  return `https://solscan.io/tx/${signature}?cluster=${config.solanaNetwork}`;
}

export function solscanAddressUrl(address) {
  if (config.solanaNetwork === 'mainnet-beta') {
    return `https://solscan.io/account/${address}`;
  }
  return `https://solscan.io/account/${address}?cluster=${config.solanaNetwork}`;
}
