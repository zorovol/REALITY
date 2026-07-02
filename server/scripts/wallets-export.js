#!/usr/bin/env node
/**
 * Export agent wallet private keys to a LOCAL gitignored file (never served over HTTP).
 * Usage: npm run wallets:export --prefix server
 *
 * Requires ENCRYPTION_KEY in server/.env or repo root .env.
 * Output: server/data/wallets-export.json (add to .gitignore — already covered by server/data/)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import '../src/config.js';
import { CAST_POOL } from '../src/engine/cast.js';
import { deriveKey, decrypt } from '../src/solana/crypto.js';
import { solanaConfig } from '../src/solana/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const WALLET_FILE = path.join(DATA_DIR, 'wallets.enc.json');
const OUT_FILE = path.join(DATA_DIR, 'wallets-export.json');

function main() {
  if (solanaConfig.simulationFallback) {
    console.error('[wallets:export] SIMULATION_FALLBACK=true — no real wallets to export.');
    process.exit(1);
  }
  if (!solanaConfig.encryptionKey) {
    console.error('[wallets:export] Set ENCRYPTION_KEY in .env first.');
    process.exit(1);
  }
  if (!fs.existsSync(WALLET_FILE)) {
    console.error('[wallets:export] No wallet file at server/data/wallets.enc.json');
    console.error('  Run the server once locally, or copy wallets.enc.json from Render.');
    process.exit(1);
  }

  const store = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
  const key = deriveKey(solanaConfig.encryptionKey);
  const exported = {
    network: solanaConfig.network,
    exportedAt: new Date().toISOString(),
    warning: 'NEVER commit or share this file. Anyone with these keys controls the funds.',
    agents: {},
  };

  for (const template of CAST_POOL) {
    const id = template.name.toLowerCase();
    const row = store.agents?.[id];
    if (!row?.secret) {
      exported.agents[id] = { name: template.name, error: 'no wallet in store' };
      continue;
    }
    const secretBs58 = decrypt(row.secret, key);
    const kp = Keypair.fromSecretKey(bs58.decode(secretBs58));
    exported.agents[id] = {
      name: template.name,
      publicKey: kp.publicKey.toBase58(),
      secretKeyBase58: bs58.encode(kp.secretKey),
      secretKeyArray: [...kp.secretKey],
    };
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(exported, null, 2));
  console.log('');
  console.log('[wallets:export] Wrote private keys to:');
  console.log(`  ${OUT_FILE}`);
  console.log('');
  console.log('  Keep this file offline. Do not commit, upload, or paste keys in chat.');
  console.log('');
}

main();
