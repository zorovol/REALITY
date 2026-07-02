import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { CAST_POOL } from '../engine/cast.js';
import { deriveKey, encrypt, decrypt } from './crypto.js';
import { solanaConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const WALLET_FILE = path.join(DATA_DIR, 'wallets.enc.json');

function agentIds() {
  return CAST_POOL.map((c) => c.name.toLowerCase());
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadStore() {
  ensureDataDir();

  const b64 = process.env.WALLETS_ENC_B64?.trim();
  if (b64) {
    try {
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch (err) {
      console.error('[wallets] Invalid WALLETS_ENC_B64:', err.message);
    }
  }

  const rawJson = process.env.WALLETS_ENC_JSON?.trim();
  if (rawJson) {
    try {
      return JSON.parse(rawJson);
    } catch (err) {
      console.error('[wallets] Invalid WALLETS_ENC_JSON:', err.message);
    }
  }

  if (!fs.existsSync(WALLET_FILE)) return { v: 1, agents: {} };
  try {
    return JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
  } catch {
    return { v: 1, agents: {} };
  }
}

function saveStore(store) {
  ensureDataDir();
  fs.writeFileSync(WALLET_FILE, JSON.stringify(store, null, 2));
}

function migrateAgentId(store, key) {
  if (store.agents?.claude && !store.agents?.fable) {
    store.agents.fable = store.agents.claude;
    delete store.agents.claude;
    return true;
  }
  return false;
}

export class WalletManager {
  constructor({ connection }) {
    this.connection = connection;
    this.keypairs = new Map();
    this.balances = new Map();
    this.encryptionKey = null;
  }

  init() {
    if (solanaConfig.simulationFallback) {
      console.log('[wallets] SIMULATION_FALLBACK=true — balances are mocked for local dev.');
      for (const id of agentIds()) {
        this.balances.set(id, 0.5);
      }
      return;
    }

    if (!solanaConfig.encryptionKey) {
      throw new Error('ENCRYPTION_KEY is required for real wallet storage (set in .env).');
    }
    this.encryptionKey = deriveKey(solanaConfig.encryptionKey);
    const store = loadStore();
    let changed = migrateAgentId(store);

    for (const id of agentIds()) {
      if (store.agents[id]?.secret) {
        const secret = decrypt(store.agents[id].secret, this.encryptionKey);
        const kp = Keypair.fromSecretKey(bs58.decode(secret));
        this.keypairs.set(id, kp);
      } else {
        const kp = Keypair.generate();
        store.agents[id] = {
          publicKey: kp.publicKey.toBase58(),
          secret: encrypt(bs58.encode(kp.secretKey), this.encryptionKey),
          createdAt: new Date().toISOString(),
        };
        this.keypairs.set(id, kp);
        changed = true;
        console.log(`[wallets] Generated new wallet for ${id}: ${kp.publicKey.toBase58()}`);
      }
    }

    const valid = new Set(agentIds());
    for (const key of Object.keys(store.agents)) {
      if (!valid.has(key)) {
        delete store.agents[key];
        changed = true;
        console.log(`[wallets] Pruned wallet for removed agent: ${key}`);
      }
    }

    if (changed) saveStore(store);
    console.log(`[wallets] ${this.keypairs.size} agent wallets loaded (secrets server-side only).`);
  }

  getKeypair(agentId) {
    return this.keypairs.get(agentId) ?? null;
  }

  getPublicKey(agentId) {
    if (solanaConfig.simulationFallback) {
      return `sim-${agentId.slice(0, 8)}...fallback`;
    }
    return this.keypairs.get(agentId)?.publicKey.toBase58() ?? null;
  }

  getPublicWallet(agentId) {
    const address = this.getPublicKey(agentId);
    const sol = this.balances.get(agentId) ?? 0;
    return {
      address,
      addressShort: address ? `${address.slice(0, 4)}…${address.slice(-4)}` : '—',
      sol: Number(sol.toFixed(4)),
      funded: sol >= solanaConfig.minSolForTrade,
      simulation: solanaConfig.simulationFallback,
    };
  }

  allPublicWallets() {
    return Object.fromEntries(agentIds().map((id) => [id, this.getPublicWallet(id)]));
  }

  async refreshBalances() {
    if (solanaConfig.simulationFallback) return;

    await Promise.all(agentIds().map(async (id) => {
      const kp = this.keypairs.get(id);
      if (!kp) return;
      try {
        const lamports = await this.connection.getBalance(kp.publicKey, 'confirmed');
        this.balances.set(id, lamports / LAMPORTS_PER_SOL);
      } catch (err) {
        console.error(`[wallets] balance check failed for ${id}:`, err.message);
      }
    }));
  }

  getBalance(agentId) {
    return this.balances.get(agentId) ?? 0;
  }

  hasFunds(agentId) {
    return this.getBalance(agentId) >= solanaConfig.minSolForTrade;
  }

  printFundingSheet() {
    const lines = [];
    lines.push('');
    lines.push('═'.repeat(72));
    lines.push('  GPTGrokGeminiDeepSeekFable — AGENT WALLET FUNDING SHEET');
    lines.push(`  Network: ${solanaConfig.network}  |  RPC: ${solanaConfig.rpcUrl}`);
    lines.push(`  Min recommended per agent: ${solanaConfig.minSolForTrade}–${solanaConfig.minSolForLaunch} SOL`);
    lines.push('═'.repeat(72));
    lines.push('');

    if (solanaConfig.simulationFallback) {
      lines.push('  SIMULATION_FALLBACK=true — no real wallets. Disable for mainnet funding.');
      lines.push('');
      return lines.join('\n');
    }

    for (const template of CAST_POOL) {
      const id = template.name.toLowerCase();
      const addr = this.getPublicKey(id);
      lines.push(`  ${template.name.padEnd(12)} ${addr}`);
      lines.push(`  ${''.padEnd(12)} solana:${addr}`);
      lines.push('');
    }

    lines.push('═'.repeat(72));
    lines.push('  Fund each address with SOL. Agents trade on pump.fun when funded.');
    lines.push('  REAL MONEY on mainnet-beta — not financial advice.');
    lines.push('═'.repeat(72));
    lines.push('');
    return lines.join('\n');
  }
}
