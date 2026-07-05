import { initPlatformOnce } from '../../server/src/auth/init.js';
import { handleLogin, sendJson } from '../../server/src/auth/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initPlatformOnce();
    sendJson(res, await handleLogin(req.body));
  } catch (err) {
    console.error('[api/login]', err.message);
    res.status(500).json({ error: 'Login failed.' });
  }
}
