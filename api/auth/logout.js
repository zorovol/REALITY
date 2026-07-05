import { initPlatformOnce } from '../../server/src/auth/init.js';
import { getAuthUser, handleLogout, sendJson } from '../../server/src/auth/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initPlatformOnce();
    const auth = await getAuthUser(req);
    sendJson(res, await handleLogout(auth));
  } catch (err) {
    res.status(500).json({ error: 'Logout failed.' });
  }
}
