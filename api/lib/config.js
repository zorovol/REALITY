/** Minimal config for Vercel serverless auth — reads env directly. */

export const config = {
  databaseUrl: process.env.DATABASE_URL || '',
  authServerKey: process.env.AUTH_SERVER_KEY || process.env.ENCRYPTION_KEY || '',
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
};
