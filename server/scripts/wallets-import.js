#!/usr/bin/env node
/**
 * Import your own agent wallets from a LOCAL gitignored file.
 * NEVER paste private keys in chat — use wallets-import.json on your machine only.
 *
 * 1. Copy wallets-import.example.json → wallets-import.json
 * 2. Fill in secretKeyBase58 for each bot
 * 3. Run: npm run wallets:import --prefix server
 *
 * Then copy server/data/wallets.enc.json + ENCRYPTION_KEY to Render for production.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import '../src/config.js';
import { CAST_POOL } from '../src/engine/cast.js';
import { deriveKey, encrypt } from '../src/solana/crypto.js';
import { solanaConfig } from '../src/solana/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const IMPORT_FILE = path.join(DATA_DIR, 'wallets-import.json');
const WALLET_FILE = path.join(DATA_DIR, 'wallets.enc.json');

const AGENT_IDS = CAST_POOL.map((c) => c.name.toLowerCase());

function parseSecret(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('secretKeyBase58 must be a non-empty string');
  }
  const trimmed = raw.trim();
  let secretKey;
  if (trimmed.startsWith('[')) {
    secretKey = Uint8Array.from(JSON.parse(trimmed));
  } else {
    secretKey = bs58.decode(trimmed);
  }
  if (secretKey.length !== 64) {
    throw new Error(`invalid secret key length ${secretKey.length} (expected 64 bytes)`);
  }
  return Keypair.fromSecretKey(secretKey);
}

function main() {
  if (!solanaConfig.encryptionKey) {
    console.error('[wallets:import] Set ENCRYPTION_KEY in server/.env first.');
    process.exit(1);
  }
  if (!fs.existsSync(IMPORT_FILE)) {
    console.error('[wallets:import] Missing server/data/wallets-import.json');
    console.error('  Copy wallets-import.example.json → wallets-import.json and fill in keys.');
    process.exit(1);
  }

  const input = JSON.parse(fs.readFileSync(IMPORT_FILE, 'utf8'));
  const agents = input.agents ?? input;
  const encKey = deriveKey(solanaConfig.encryptionKey);
  const store = { v: 1, agents: {} };

  for (const id of AGENT_IDS) {
    const row = agents[id];
    if (!row?.secretKeyBase58 && !row?.secretKey) {
      console.error(`[wallets:import] Missing secret for agent "${id}"`);
      process.exit(1);
    }
    const kp = parseSecret(row.secretKeyBase58 ?? row.secretKey);
    store.agents[id] = {
      publicKey: kp.publicKey.toBase58(),
      secret: encrypt(bs58.encode(kp.secretKey), encKey),
      createdAt: new Date().toISOString(),
      imported: true,
    };
    console.log(`[wallets:import] ${id.padEnd(10)} ${kp.publicKey.toBase58()}`);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(WALLET_FILE, JSON.stringify(store, null, 2));

  console.log('');
  console.log(`[wallets:import] Saved encrypted wallets → ${WALLET_FILE}`);
  console.log('[wallets:import] Delete wallets-import.json after import (contains plaintext keys).');
  console.log('[wallets:import] For production: upload wallets.enc.json to Render + same ENCRYPTION_KEY.');
  console.log('');
}

main();
