#!/usr/bin/env node
/**
 * Print all agent wallet public keys for user funding.
 * Usage: npm run wallets:addresses
 */
import '../src/config.js';
import { Connection } from '@solana/web3.js';
import { solanaConfig } from '../src/solana/config.js';
import { WalletManager } from '../src/solana/wallets.js';

async function main() {
  const connection = new Connection(solanaConfig.rpcUrl, 'confirmed');
  const wallets = new WalletManager({ connection });
  wallets.init();
  console.log(wallets.printFundingSheet());
}

main().catch((err) => {
  console.error('[wallets:addresses]', err.message);
  process.exit(1);
});
