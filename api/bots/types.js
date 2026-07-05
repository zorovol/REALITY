import { initPlatformOnce } from '../../server/src/auth/init.js';
import { handleBotTypes, sendJson } from '../../server/src/auth/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initPlatformOnce();
    sendJson(res, await handleBotTypes());
  } catch (err) {
    res.status(500).json({ error: 'Failed to load bot types.' });
  }
}
