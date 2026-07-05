import { initOnce, getAuthUser, handleMe, sendJson } from '../lib/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    await initOnce();
    return sendJson(res, await handleMe(await getAuthUser(req)));
  } catch (err) {
    console.error('[api/auth/me]', err);
    return res.status(500).json({ error: err.message || 'Auth check failed.' });
  }
}
