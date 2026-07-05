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
  if (Array.isArray(parts) && parts.length) return parts.join('/');
  if (parts) return String(parts);
  const url = (req.url || '').split('?')[0];
  const match = url.match(/^\/api\/(.+)/);
  return match ? match[1] : '';
}

export default async function handler(req, res) {
  const route = routePath(req);
  const method = req.method;

  try {
    await initOnce();

    if (route === 'auth/signup' && method === 'POST') {
      return sendJson(res, await handleSignup(req.body));
    }
    if (route === 'auth/login' && method === 'POST') {
      return sendJson(res, await handleLogin(req.body));
    }
    if (route === 'auth/logout' && method === 'POST') {
      return sendJson(res, await handleLogout(await getAuthUser(req)));
    }
    if (route === 'auth/me' && method === 'GET') {
      return sendJson(res, await handleMe(await getAuthUser(req)));
    }

    if (route === 'bots/types' && method === 'GET') {
      return sendJson(res, await handleBotTypes());
    }
    if (route === 'bots' && method === 'GET') {
      return sendJson(res, await handleListBots(await getAuthUser(req)));
    }
    if (route === 'bots' && method === 'POST') {
      return sendJson(res, await handleCreateBot(await getAuthUser(req), req.body));
    }

    const botMatch = route.match(/^bots\/([^/]+)$/);
    if (botMatch) {
      const id = botMatch[1];
      const auth = await getAuthUser(req);
      if (method === 'PATCH') return sendJson(res, await handleUpdateBot(auth, id, req.body));
      if (method === 'DELETE') return sendJson(res, await handleDeleteBot(auth, id));
    }

    const startMatch = route.match(/^bots\/([^/]+)\/start$/);
    if (startMatch && method === 'POST') {
      return sendJson(res, await handleStartBot(await getAuthUser(req), startMatch[1]));
    }
    const stopMatch = route.match(/^bots\/([^/]+)\/stop$/);
    if (stopMatch && method === 'POST') {
      return sendJson(res, await handleStopBot(await getAuthUser(req), stopMatch[1]));
    }

    if (route === 'wallet/balance' && method === 'GET') {
      return sendJson(res, await handleWalletBalance(await getAuthUser(req)));
    }

    return res.status(404).json({ error: route ? `Unknown route: /api/${route}` : 'Not found' });
  } catch (err) {
    console.error('[api]', route, err);
    res.status(500).json({ error: err.message || 'Internal server error.' });
  }
}
