import { initOnce, getAuthUser, handleStopBot, sendJson } from '../lib/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initOnce();
    sendJson(res, await handleStopBot(await getAuthUser(req), req.query.id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop bot.' });
  }
}
