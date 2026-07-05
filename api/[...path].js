const RENDER_API = 'https://ai-drama-island-api.onrender.com';

function routePath(req) {
  const parts = req.query?.path;
  if (Array.isArray(parts) && parts.length) return parts.join('/');
  if (parts) return String(parts);
  const url = (req.url || '').split('?')[0];
  const match = url.match(/\/api\/(.+)/);
  return match ? match[1] : '';
}

function isPlatformRoute(route) {
  return route.startsWith('auth/')
    || route === 'bots/types'
    || route.startsWith('bots')
    || route === 'wallet/balance';
}

async function proxyToRender(req, res, route) {
  const qs = (req.url || '').includes('?') ? `?${req.url.split('?')[1]}` : '';
  const url = `${RENDER_API}/api/${route}${qs}`;
  const headers = {};
  if (req.headers?.cookie) headers.cookie = req.headers.cookie;
  if (req.headers?.['content-type']) headers['content-type'] = req.headers['content-type'];

  const init = { method: req.method, headers };
  if (req.body && req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = JSON.stringify(req.body);
    headers['content-type'] = 'application/json';
  }

  const upstream = await fetch(url, init);
  const text = await upstream.text();
  const ct = upstream.headers.get('content-type') || 'application/json';
  res.status(upstream.status);
  res.setHeader('Content-Type', ct);
  res.end(text);
}

export default async function handler(req, res) {
  const route = routePath(req);
  const method = req.method;

  try {
    if (!isPlatformRoute(route)) {
      return proxyToRender(req, res, route);
    }

    const {
      initOnce, getAuthUser, sendJson,
      handleBotTypes, handleListBots, handleCreateBot,
      handleUpdateBot, handleStartBot, handleStopBot,
      handleDeleteBot, handleBotTrades, handleWalletBalance,
    } = await import('./lib/handlers.js');

    await initOnce();

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

    const tradesMatch = route.match(/^bots\/([^/]+)\/trades$/);
    if (tradesMatch && method === 'GET') {
      return sendJson(res, await handleBotTrades(await getAuthUser(req), tradesMatch[1]));
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
