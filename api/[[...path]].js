import {
  initOnce,
  getAuthUser,
  sendJson,
  handleSignup,
  handleLogin,
  handleLogout,
  handleMe,
  handleBotTypes,
  handleListBots,
  handleCreateBot,
  handleUpdateBot,
  handleStartBot,
  handleStopBot,
  handleDeleteBot,
  handleWalletBalance,
} from './lib/handlers.js';

function routePath(req) {
  const parts = req.query.path;
  if (Array.isArray(parts)) return parts.join('/');
  if (parts) return String(parts);
  return '';
}

export default async function handler(req, res) {
  const route = routePath(req);
  const method = req.method;

  try {
    await initOnce();

    // POST /api/auth/signup
    if (route === 'auth/signup' && method === 'POST') {
      return sendJson(res, await handleSignup(req.body));
    }
    // POST /api/auth/login
    if (route === 'auth/login' && method === 'POST') {
      return sendJson(res, await handleLogin(req.body));
    }
    // POST /api/auth/logout
    if (route === 'auth/logout' && method === 'POST') {
      return sendJson(res, await handleLogout(await getAuthUser(req)));
    }
    // GET /api/auth/me
    if (route === 'auth/me' && method === 'GET') {
      return sendJson(res, await handleMe(await getAuthUser(req)));
    }

    // GET /api/bots/types
    if (route === 'bots/types' && method === 'GET') {
      return sendJson(res, await handleBotTypes());
    }
    // GET|POST /api/bots
    if (route === 'bots' && method === 'GET') {
      return sendJson(res, await handleListBots(await getAuthUser(req)));
    }
    if (route === 'bots' && method === 'POST') {
      return sendJson(res, await handleCreateBot(await getAuthUser(req), req.body));
    }

    // PATCH|DELETE /api/bots/:id
    const botMatch = route.match(/^bots\/([^/]+)$/);
    if (botMatch) {
      const id = botMatch[1];
      const auth = await getAuthUser(req);
      if (method === 'PATCH') return sendJson(res, await handleUpdateBot(auth, id, req.body));
      if (method === 'DELETE') return sendJson(res, await handleDeleteBot(auth, id));
    }

    // POST /api/bots/:id/start | stop
    const startMatch = route.match(/^bots\/([^/]+)\/start$/);
    if (startMatch && method === 'POST') {
      return sendJson(res, await handleStartBot(await getAuthUser(req), startMatch[1]));
    }
    const stopMatch = route.match(/^bots\/([^/]+)\/stop$/);
    if (stopMatch && method === 'POST') {
      return sendJson(res, await handleStopBot(await getAuthUser(req), stopMatch[1]));
    }

    // GET /api/wallet/balance
    if (route === 'wallet/balance' && method === 'GET') {
      return sendJson(res, await handleWalletBalance(await getAuthUser(req)));
    }

    return res.status(404).json({ error: `Unknown route: /api/${route}` });
  } catch (err) {
    console.error('[api]', route, err);
    res.status(500).json({ error: err.message || 'Internal server error.' });
  }
}
