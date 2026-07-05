import { initOnce, getAuthUser, handleStartBot, sendJson } from '../lib/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initOnce();
    sendJson(res, await handleStartBot(await getAuthUser(req), req.query.id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to start bot.' });
  }
}
