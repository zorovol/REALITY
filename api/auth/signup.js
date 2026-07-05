import { initPlatformOnce } from '../../server/src/auth/init.js';
import { handleSignup, sendJson } from '../../server/src/auth/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initPlatformOnce();
    sendJson(res, await handleSignup(req.body));
  } catch (err) {
    console.error('[api/signup]', err.message);
    res.status(500).json({ error: err.message || 'Signup failed.' });
  }
}
