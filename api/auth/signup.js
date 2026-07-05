import { initOnce, handleSignup, sendJson } from '../lib/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initOnce();
    sendJson(res, await handleSignup(req.body));
  } catch (err) {
    console.error('[api/signup]', err);
    res.status(500).json({ error: err.message || 'Signup failed.' });
  }
}
