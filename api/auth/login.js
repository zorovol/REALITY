import { initOnce, handleLogin, sendJson } from '../lib/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initOnce();
    sendJson(res, await handleLogin(req.body));
  } catch (err) {
    console.error('[api/login]', err);
    res.status(500).json({ error: 'Login failed.' });
  }
}
