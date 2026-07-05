import { initOnce, handleLogin, sendJson } from '../lib/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    await initOnce();
    return sendJson(res, await handleLogin(req.body));
  } catch (err) {
    console.error('[api/auth/login]', err);
    return res.status(500).json({ error: err.message || 'Login failed.' });
  }
}
