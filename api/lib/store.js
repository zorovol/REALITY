import { randomUUID } from 'node:crypto';
import { getDatabaseUrl } from './config.js';

let pool = null;
let ready = false;

const mem = { users: new Map(), sessions: new Map(), bots: new Map(), botTrades: [], nextTradeId: 1 };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  user_salt TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  server_encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bot_type TEXT NOT NULL,
  trading_rules JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  position JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bot_trades (
  id BIGSERIAL PRIMARY KEY,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  side TEXT NOT NULL,
  mint TEXT, symbol TEXT, sol_amount DOUBLE PRECISION,
  signature TEXT, explorer_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function initStore() {
  if (ready) return;
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    ready = false;
    return;
  }
  try {
    const pg = await import('pg');
    pool = new pg.default.Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 2,
    });
    await pool.query(SCHEMA);
    ready = true;
  } catch (err) {
    console.error('[api/store] DB init failed, using memory:', err.message);
    pool = null;
    ready = false;
  }
}

async function q(text, params) {
  if (!ready || !pool) return null;
  return pool.query(text, params);
}

function rowUser(r) {
  return {
    id: r.id,
    walletAddress: r.wallet_address,
    passwordHash: r.password_hash,
    userSalt: r.user_salt,
    encryptedPrivateKey: r.encrypted_private_key,
    serverEncryptedKey: r.server_encrypted_key,
    createdAt: r.created_at,
  };
}

function rowBot(r) {
  return {
    id: r.id, userId: r.user_id, botType: r.bot_type,
    tradingRules: r.trading_rules, isActive: r.is_active,
    position: r.position ?? null, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function createUser(data) {
  if (!ready) {
    const id = randomUUID();
    const user = {
      id,
      walletAddress: data.walletAddress,
      passwordHash: data.passwordHash,
      userSalt: data.userSalt,
      encryptedPrivateKey: data.encryptedPrivateKey,
      serverEncryptedKey: data.serverEncryptedKey,
      createdAt: new Date().toISOString(),
    };
    mem.users.set(id, user);
    mem.users.set(`addr:${data.walletAddress}`, id);
    return user;
  }
  const res = await q(
    `INSERT INTO users (wallet_address, password_hash, user_salt, encrypted_private_key, server_encrypted_key)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.walletAddress, data.passwordHash, data.userSalt, data.encryptedPrivateKey, data.serverEncryptedKey],
  );
  return rowUser(res.rows[0]);
}

export async function findUserByWallet(walletAddress) {
  if (!ready) {
    const id = mem.users.get(`addr:${walletAddress}`);
    return id ? mem.users.get(id) : null;
  }
  const res = await q('SELECT * FROM users WHERE wallet_address = $1', [walletAddress]);
  return res?.rows[0] ? rowUser(res.rows[0]) : null;
}

export async function findUserById(userId) {
  if (!ready) return mem.users.get(userId) ?? null;
  const res = await q('SELECT * FROM users WHERE id = $1', [userId]);
  return res?.rows[0] ? rowUser(res.rows[0]) : null;
}

export async function createSession(token, userId, expiresAt) {
  if (!ready) { mem.sessions.set(token, { userId, expiresAt: expiresAt.toISOString() }); return; }
  await q('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)', [token, userId, expiresAt]);
}

export async function findSession(token) {
  if (!ready) {
    const s = mem.sessions.get(token);
    if (!s || new Date(s.expiresAt) < new Date()) return null;
    return { userId: s.userId };
  }
  const res = await q('SELECT user_id FROM sessions WHERE token = $1 AND expires_at > now()', [token]);
  return res?.rows[0] ? { userId: res.rows[0].user_id } : null;
}

export async function deleteSession(token) {
  if (!ready) { mem.sessions.delete(token); return; }
  await q('DELETE FROM sessions WHERE token = $1', [token]);
}

export async function createBot({ userId, botType, tradingRules }) {
  if (!ready) {
    const id = randomUUID();
    const bot = { id, userId, botType, tradingRules, isActive: false, position: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    mem.bots.set(id, bot);
    return bot;
  }
  const res = await q('INSERT INTO bots (user_id, bot_type, trading_rules) VALUES ($1,$2,$3) RETURNING *', [userId, botType, tradingRules]);
  return rowBot(res.rows[0]);
}

export async function listBotsForUser(userId) {
  if (!ready) return [...mem.bots.values()].filter((b) => b.userId === userId);
  const res = await q('SELECT * FROM bots WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return res.rows.map(rowBot);
}

export async function findBot(botId, userId) {
  if (!ready) {
    const b = mem.bots.get(botId);
    return b?.userId === userId ? b : null;
  }
  const res = await q('SELECT * FROM bots WHERE id = $1 AND user_id = $2', [botId, userId]);
  return res?.rows[0] ? rowBot(res.rows[0]) : null;
}

export async function updateBot(botId, userId, patch) {
  if (!ready) {
    const b = mem.bots.get(botId);
    if (!b || b.userId !== userId) return null;
    Object.assign(b, patch, { updatedAt: new Date().toISOString() });
    return b;
  }
  const fields = []; const vals = []; let i = 1;
  if (patch.botType !== undefined) { fields.push(`bot_type = $${i++}`); vals.push(patch.botType); }
  if (patch.tradingRules !== undefined) { fields.push(`trading_rules = $${i++}`); vals.push(patch.tradingRules); }
  if (patch.isActive !== undefined) { fields.push(`is_active = $${i++}`); vals.push(patch.isActive); }
  if (patch.position !== undefined) { fields.push(`position = $${i++}`); vals.push(patch.position); }
  if (!fields.length) return findBot(botId, userId);
  fields.push('updated_at = now()');
  vals.push(botId, userId);
  const res = await q(`UPDATE bots SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i} RETURNING *`, vals);
  return res?.rows[0] ? rowBot(res.rows[0]) : null;
}

export async function deleteBot(botId, userId) {
  if (!ready) {
    const b = mem.bots.get(botId);
    if (!b || b.userId !== userId) return false;
    mem.bots.delete(botId);
    return true;
  }
  const res = await q('DELETE FROM bots WHERE id = $1 AND user_id = $2', [botId, userId]);
  return (res?.rowCount ?? 0) > 0;
}

export async function listBotTrades(botId, userId, limit = 50) {
  if (!ready) return mem.botTrades.filter((t) => t.botId === botId && t.userId === userId).slice(0, limit);
  const res = await q('SELECT * FROM bot_trades WHERE bot_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT $3', [botId, userId, limit]);
  return res?.rows ?? [];
}

export const BOT_TYPES = ['chatgpt', 'grok', 'fable', 'gemini', 'deepseek'];

export function defaultTradingRules() {
  return { minMarketCap: 2500, maxMarketCap: 6000, buyAmountSol: 0.015, takeProfitPercent: 8, stopLossPercent: 5 };
}

export function normalizeRules(input = {}) {
  const d = defaultTradingRules();
  return {
    minMarketCap: Number(input.minMarketCap) || d.minMarketCap,
    maxMarketCap: Number(input.maxMarketCap) || d.maxMarketCap,
    buyAmountSol: Number(input.buyAmountSol) || d.buyAmountSol,
    takeProfitPercent: Number(input.takeProfitPercent) || d.takeProfitPercent,
    stopLossPercent: Number(input.stopLossPercent) || d.stopLossPercent,
  };
}
