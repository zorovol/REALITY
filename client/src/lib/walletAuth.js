/**
 * Browser-only wallet accounts — EVM wallets for Robinhood Chain.
 */

const WALLETS_KEY = 'botforge_wallets';
const SESSION_KEY = 'botforge_session';

function readWallets() {
  try {
    return JSON.parse(localStorage.getItem(WALLETS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeWallets(map) {
  localStorage.setItem(WALLETS_KEY, JSON.stringify(map));
}

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 120_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptSecret(secret, password, salt) {
  const key = await deriveKey(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(secret),
  );
  return `${toHex(iv)}:${toHex(new Uint8Array(cipher))}`;
}

export async function decryptSecret(encryptedKey, password, salt) {
  const [ivHex, cipherHex] = encryptedKey.split(':');
  if (!ivHex || !cipherHex) throw new Error('Invalid wallet data.');
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromHex(ivHex) },
    key,
    fromHex(cipherHex),
  );
  return new TextDecoder().decode(plain);
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.walletAddress) return null;
    const wallets = readWallets();
    if (!wallets[session.walletAddress.toLowerCase()] && !wallets[session.walletAddress]) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return {
      walletAddress: session.walletAddress,
      createdAt: wallets[session.walletAddress]?.createdAt
        ?? wallets[session.walletAddress.toLowerCase()]?.createdAt,
    };
  } catch {
    return null;
  }
}

export function setSession(walletAddress) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ walletAddress }));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function createAccount(password) {
  const { Wallet } = await import('ethers');
  const wallet = Wallet.createRandom();
  const walletAddress = wallet.address;
  const secretKey = wallet.privateKey;

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encryptedKey = await encryptSecret(secretKey, password, salt);

  const wallets = readWallets();
  const key = walletAddress.toLowerCase();
  if (wallets[key] || wallets[walletAddress]) {
    throw new Error('Wallet already exists on this device.');
  }

  wallets[key] = {
    walletAddress,
    salt: toHex(salt),
    encryptedKey,
    createdAt: new Date().toISOString(),
  };
  writeWallets(wallets);
  setSession(walletAddress);

  return { walletAddress, secretKey };
}

export async function getWalletSecretKey(walletAddress, password) {
  const wallets = readWallets();
  const addr = String(walletAddress).trim();
  const record = wallets[addr] ?? wallets[addr.toLowerCase()];
  if (!record) return null;
  try {
    return await decryptSecret(record.encryptedKey, password, fromHex(record.salt));
  } catch {
    return null;
  }
}

export async function loginAccount(walletAddress, password) {
  const addr = String(walletAddress || '').trim();
  const wallets = readWallets();
  const record = wallets[addr] ?? wallets[addr.toLowerCase()];
  if (!record) {
    throw new Error('Wallet not found on this device. Sign up here first, or use the browser where you created it.');
  }

  try {
    await decryptSecret(record.encryptedKey, password, fromHex(record.salt));
  } catch {
    throw new Error('Invalid wallet address or password.');
  }

  setSession(record.walletAddress || addr);
  return { walletAddress: record.walletAddress || addr, createdAt: record.createdAt };
}

export async function getWalletBalance(walletAddress) {
  const { JsonRpcProvider, formatEther } = await import('ethers');
  const { CHAIN } = await import('../config/chain.js');
  const provider = new JsonRpcProvider(CHAIN.rpcUrl, CHAIN.chainId);
  const bal = await provider.getBalance(walletAddress);
  return Number(formatEther(bal));
}
