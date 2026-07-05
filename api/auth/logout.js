import { initOnce, getAuthUser, handleLogout, sendJson } from '../lib/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initOnce();
    sendJson(res, await handleLogout(await getAuthUser(req)));
  } catch (err) {
    res.status(500).json({ error: 'Logout failed.' });
  }
}
