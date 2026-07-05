/** Lazy env reads — Vercel bundler chokes on `process.env.X || ''` at module scope. */

export function getDatabaseUrl() {
  return process.env.DATABASE_URL;
}

export function getAuthServerKey() {
  if (process.env.AUTH_SERVER_KEY) return process.env.AUTH_SERVER_KEY;
  if (process.env.ENCRYPTION_KEY) return process.env.ENCRYPTION_KEY;
  return '';
}

export function getSolanaRpcUrl() {
  if (process.env.SOLANA_RPC_URL) return process.env.SOLANA_RPC_URL;
  return 'https://api.mainnet-beta.solana.com';
}

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}
