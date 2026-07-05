import { randomBytes } from 'node:crypto';
import {
  findUserById,
  findSession,
  deleteSession,
} from './store.js';
import {
  handleSignup,
  handleLogin,
  handleLogout,
  handleMe,
  sendJson,
} from './handlers.js';

const SESSION_COOKIE = 'adi_session';

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
  const maxAge = 7 * 86400;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`,
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
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
      sendJson(res, await handleSignup(req.body));
    } catch (err) {
      console.error('[auth] signup error:', err.message);
      res.status(500).json({ error: err.message || 'Signup failed.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      sendJson(res, await handleLogin(req.body));
    } catch (err) {
      console.error('[auth] login error:', err.message);
      res.status(500).json({ error: 'Login failed.' });
    }
  });

  app.post('/api/auth/logout', requireAuth, async (req, res) => {
    sendJson(res, await handleLogout({ user: req.user, sessionToken: req.sessionToken }));
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    sendJson(res, await handleMe({ user: req.user }));
  });
}

void randomBytes;
