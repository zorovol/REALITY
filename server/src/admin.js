import crypto from 'node:crypto';
import { config } from './config.js';

const sessions = new Map();
const SESSION_MS = 60 * 60 * 1000; // 1 hour

function pruneSessions() {
  const now = Date.now();
  for (const [token, exp] of sessions) {
    if (exp < now) sessions.delete(token);
  }
}

export function adminEnabled() {
  return Boolean(config.adminPassword);
}

export function login(password) {
  if (!adminEnabled()) {
    return { ok: false, error: 'Admin not configured. Set ADMIN_PASSWORD in .env.' };
  }
  const a = Buffer.from(String(password));
  const b = Buffer.from(config.adminPassword);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'Invalid password.' };
  }
  pruneSessions();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_MS;
  sessions.set(token, expiresAt);
  return { ok: true, token, expiresAt };
}

export function logout(token) {
  if (token) sessions.delete(token);
}

export function requireAdmin(req, res, next) {
  if (!adminEnabled()) {
    return res.status(503).json({ error: 'Admin not configured. Set ADMIN_PASSWORD in .env.' });
  }
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized.' });
  pruneSessions();
  const exp = sessions.get(token);
  if (!exp || exp < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Session expired. Log in again.' });
  }
  req.adminToken = token;
  next();
}
