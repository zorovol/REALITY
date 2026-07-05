import { initOnce, getAuthUser, handleWalletBalance, sendJson } from '../lib/handlers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await initOnce();
    sendJson(res, await handleWalletBalance(await getAuthUser(req)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch balance.' });
  }
}
