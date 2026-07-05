import { initOnce, getAuthUser, handleUpdateBot, handleDeleteBot, sendJson } from '../lib/handlers.js';

export default async function handler(req, res) {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Bot id required.' });
  try {
    await initOnce();
    const auth = await getAuthUser(req);
    if (req.method === 'PATCH') return sendJson(res, await handleUpdateBot(auth, id, req.body));
    if (req.method === 'DELETE') return sendJson(res, await handleDeleteBot(auth, id));
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: 'Bot request failed.' });
  }
}
