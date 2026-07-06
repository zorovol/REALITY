import { removeFloorBot } from '../../../lib/floorStore.js';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Bot id required.' });

  try {
    if (req.method === 'DELETE') {
      const { walletAddress } = req.body ?? {};
      if (!walletAddress) return res.status(400).json({ error: 'walletAddress required.' });
      const result = removeFloorBot(String(id), String(walletAddress).trim());
      if (result.error) return res.status(403).json({ error: result.error });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/floor/bots/id]', err);
    return res.status(500).json({ error: err.message || 'Floor API error' });
  }
}
