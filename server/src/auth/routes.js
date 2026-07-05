import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import {
  createUser,
  findUserByWallet,
  findUserById,
  createSession,
  findSession,
  deleteSession,
} from './store.js';
import {
  hashPassword,
  verifyPassword,
  encryptWithPassword,
  encryptWithServerKey,
  newUserSalt,
} from './crypto.js';

const SESSION_COOKIE = 'adi_session';
const SESSION_DAYS = 7;

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [k, ...v] = part.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    }).filter(([k]) => k),
  );
}

export function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 86400;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`,
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

function newSessionToken() {
  return randomBytes(32).toString('hex');
}

export async function requireAuth(req, res, next) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[SESSION_COOKIE];
    if (!token) return res.status(401).json({ error: 'Not authenticated.' });

    const session = await findSession(token);
    if (!session) return res.status(401).json({ error: 'Session expired.' });

    const user = await findUserById(session.userId);
    if (!user) return res.status(401).json({ error: 'User not found.' });

    req.user = user;
    req.sessionToken = token;
    next();
  } catch (err) {
    console.error('[auth] middleware error:', err.message);
    res.status(500).json({ error: 'Auth check failed.' });
  }
}

export function mountAuthRoutes(app) {
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { password } = req.body ?? {};
      if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }

      const { Keypair } = await import('@solana/web3.js');
      const bs58 = (await import('bs58')).default;
      const keypair = Keypair.generate();
      const walletAddress = keypair.publicKey.toBase58();
      const secretKey = bs58.encode(keypair.secretKey);

      const userSalt = newUserSalt();
      const passwordHash = hashPassword(password);
      const encryptedPrivateKey = encryptWithPassword(secretKey, password, userSalt);
      const serverEncryptedKey = encryptWithServerKey(secretKey, config.authServerKey);

      const user = await createUser({
        walletAddress,
        passwordHash,
        userSalt,
        encryptedPrivateKey,
        serverEncryptedKey,
      });

      const token = newSessionToken();
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
      await createSession(token, user.id, expiresAt);
      setSessionCookie(res, token);

      res.status(201).json({
        walletAddress: user.walletAddress,
        message: 'Account created. Your wallet address is your username.',
      });
    } catch (err) {
      console.error('[auth] signup error:', err.message);
      res.status(500).json({ error: err.message || 'Signup failed.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body ?? {};
      if (!username || !password) {
        return res.status(400).json({ error: 'Wallet address and password required.' });
      }

      const user = await findUserByWallet(String(username).trim());
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Invalid wallet address or password.' });
      }

      const token = newSessionToken();
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
      await createSession(token, user.id, expiresAt);
      setSessionCookie(res, token);

      res.json({
        walletAddress: user.walletAddress,
        message: 'Logged in.',
      });
    } catch (err) {
      console.error('[auth] login error:', err.message);
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  app.post('/api/auth/logout', requireAuth, async (req, res) => {
    await deleteSession(req.sessionToken);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    res.json({
      walletAddress: req.user.walletAddress,
      createdAt: req.user.createdAt,
    });
  });
}
