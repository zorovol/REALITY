import { initPlatformOnce } from '../../server/src/auth/init.js';
import {
  getAuthUser,
  handleListBots,
  handleCreateBot,
  sendJson,
} from '../../server/src/auth/handlers.js';

export default async function handler(req, res) {
  try {
    await initPlatformOnce();
    const auth = await getAuthUser(req);
    if (req.method === 'GET') return sendJson(res, await handleListBots(auth));
    if (req.method === 'POST') return sendJson(res, await handleCreateBot(auth, req.body));
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/bots]', err.message);
    res.status(500).json({ error: 'Bot request failed.' });
  }
}
