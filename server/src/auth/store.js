/**
 * User / session / bot persistence — Postgres when available, in-memory fallback for dev.
 */

import { randomUUID } from 'node:crypto';
import { dbReady, dbPool } from '../db.js';

let ready = false;

const mem = {
  users: new Map(),
  sessions: new Map(),
  bots: new Map(),
  botTrades: [],
  nextBotId: 1,
  nextTradeId: 1,
};

const PLATFORM_SCHEMA = `
-- platform tables created via main db.js SCHEMA
`;

export async function initPlatformStore() {
  ready = dbReady();
  if (!ready) {
    console.log('[platform] No DATABASE_URL — user/bot data in memory (resets on restart).');
  } else {
    console.log('[platform] User/bot store ready.');
  }
  return ready;
}

export function platformReady() {
  return ready;
}

async function q(text, params) {
  const pool = dbPool();
  if (!ready || !pool) return null;
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('[platform] query error:', err.message);
    throw err;
  }
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
    id: r.id,
    userId: r.user_id,
    name: r.name ?? '',
    botType: r.bot_type,
    tradingRules: r.trading_rules,
    isActive: r.is_active,
    position: r.position ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function updateUserKeys(userId, { serverEncryptedKey, encryptedPrivateKey }) {
  if (!ready) {
    const user = mem.users.get(userId);
    if (!user) return null;
    if (serverEncryptedKey) user.serverEncryptedKey = serverEncryptedKey;
    if (encryptedPrivateKey) user.encryptedPrivateKey = encryptedPrivateKey;
    return user;
  }
  const fields = [];
  const vals = [];
  let i = 1;
  if (serverEncryptedKey !== undefined) { fields.push(`server_encrypted_key = $${i++}`); vals.push(serverEncryptedKey); }
  if (encryptedPrivateKey !== undefined) { fields.push(`encrypted_private_key = $${i++}`); vals.push(encryptedPrivateKey); }
  if (!fields.length) return findUserById(userId);
  vals.push(userId);
  const res = await q(`UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  return res.rows[0] ? rowUser(res.rows[0]) : null;
}

export async function createUser({ walletAddress, passwordHash, userSalt, encryptedPrivateKey, serverEncryptedKey }) {
  if (!ready) {
    const id = randomUUID();
    const user = {
      id,
      walletAddress,
      passwordHash,
      userSalt,
      encryptedPrivateKey,
      serverEncryptedKey,
      createdAt: new Date().toISOString(),
    };
    mem.users.set(id, user);
    mem.users.set(`addr:${walletAddress}`, id);
    return user;
  }
  const res = await q(
    `INSERT INTO users (wallet_address, password_hash, user_salt, encrypted_private_key, server_encrypted_key)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [walletAddress, passwordHash, userSalt, encryptedPrivateKey, serverEncryptedKey],
  );
  return rowUser(res.rows[0]);
}

export async function findUserByWallet(walletAddress) {
  if (!ready) {
    const id = mem.users.get(`addr:${walletAddress}`);
    return id ? mem.users.get(id) : null;
  }
  const res = await q('SELECT * FROM users WHERE wallet_address = $1', [walletAddress]);
  return res.rows[0] ? rowUser(res.rows[0]) : null;
}

export async function findUserById(userId) {
  if (!ready) return mem.users.get(userId) ?? null;
  const res = await q('SELECT * FROM users WHERE id = $1', [userId]);
  return res.rows[0] ? rowUser(res.rows[0]) : null;
}

export async function createSession(token, userId, expiresAt) {
  if (!ready) {
    mem.sessions.set(token, { userId, expiresAt: expiresAt.toISOString() });
    return;
  }
  await q('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, expiresAt]);
}

export async function findSession(token) {
  if (!ready) {
    const s = mem.sessions.get(token);
    if (!s) return null;
    if (new Date(s.expiresAt) < new Date()) {
      mem.sessions.delete(token);
      return null;
    }
    return { userId: s.userId, expiresAt: s.expiresAt };
  }
  const res = await q(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1 AND expires_at > now()',
    [token],
  );
  if (!res.rows[0]) return null;
  return { userId: res.rows[0].user_id, expiresAt: res.rows[0].expires_at };
}

export async function deleteSession(token) {
  if (!ready) {
    mem.sessions.delete(token);
    return;
  }
  await q('DELETE FROM sessions WHERE token = $1', [token]);
}

export async function createBot({ userId, name, botType, tradingRules }) {
  const rules = { ...tradingRules };
  const botName = String(name || '').trim();
  if (!ready) {
    const id = randomUUID();
    const bot = {
      id,
      userId,
      name: botName,
      botType,
      tradingRules: rules,
      isActive: false,
      position: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mem.bots.set(id, bot);
    return bot;
  }
  const res = await q(
    `INSERT INTO bots (user_id, name, bot_type, trading_rules) VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, botName, botType, rules],
  );
  return rowBot(res.rows[0]);
}

export async function listBotsForUser(userId) {
  if (!ready) {
    return [...mem.bots.values()].filter((b) => b.userId === userId);
  }
  const res = await q('SELECT * FROM bots WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return res.rows.map(rowBot);
}

export async function findBot(botId, userId) {
  if (!ready) {
    const b = mem.bots.get(botId);
    return b && b.userId === userId ? b : null;
  }
  const res = await q('SELECT * FROM bots WHERE id = $1 AND user_id = $2', [botId, userId]);
  return res.rows[0] ? rowBot(res.rows[0]) : null;
}

export async function updateBot(botId, userId, patch) {
  if (!ready) {
    const b = mem.bots.get(botId);
    if (!b || b.userId !== userId) return null;
    Object.assign(b, patch, { updatedAt: new Date().toISOString() });
    return b;
  }
  const fields = [];
  const vals = [];
  let i = 1;
  if (patch.botType !== undefined) { fields.push(`bot_type = $${i++}`); vals.push(patch.botType); }
  if (patch.name !== undefined) { fields.push(`name = $${i++}`); vals.push(String(patch.name).trim()); }
  if (patch.tradingRules !== undefined) { fields.push(`trading_rules = $${i++}`); vals.push(patch.tradingRules); }
  if (patch.isActive !== undefined) { fields.push(`is_active = $${i++}`); vals.push(patch.isActive); }
  if (patch.position !== undefined) { fields.push(`position = $${i++}`); vals.push(patch.position); }
  if (!fields.length) return findBot(botId, userId);
  fields.push(`updated_at = now()`);
  vals.push(botId, userId);
  const res = await q(
    `UPDATE bots SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
    vals,
  );
  return res.rows[0] ? rowBot(res.rows[0]) : null;
}

export async function deleteBot(botId, userId) {
  if (!ready) {
    const b = mem.bots.get(botId);
    if (!b || b.userId !== userId) return false;
    mem.bots.delete(botId);
    return true;
  }
  const res = await q('DELETE FROM bots WHERE id = $1 AND user_id = $2', [botId, userId]);
  return (res.rowCount ?? 0) > 0;
}

export async function listActiveBots() {
  if (!ready) {
    return [...mem.bots.values()].filter((b) => b.isActive);
  }
  const res = await q('SELECT * FROM bots WHERE is_active = true');
  return res.rows.map(rowBot);
}

export async function insertBotTrade({ botId, userId, side, mint, symbol, solAmount, signature, explorerUrl }) {
  if (!ready) {
    const trade = {
      id: mem.nextTradeId++,
      botId,
      userId,
      side,
      mint,
      symbol,
      solAmount,
      signature,
      explorerUrl,
      createdAt: new Date().toISOString(),
    };
    mem.botTrades.unshift(trade);
    return trade;
  }
  const res = await q(
    `INSERT INTO bot_trades (bot_id, user_id, side, mint, symbol, sol_amount, signature, explorer_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [botId, userId, side, mint, symbol, solAmount, signature, explorerUrl],
  );
  return res.rows[0];
}

export async function listBotTrades(botId, userId, limit = 50) {
  if (!ready) {
    return mem.botTrades.filter((t) => t.botId === botId && t.userId === userId).slice(0, limit);
  }
  const res = await q(
    'SELECT * FROM bot_trades WHERE bot_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT $3',
    [botId, userId, limit],
  );
  return res.rows;
}
