import { listFloorBots, upsertFloorBot } from '../lib/floorStore.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ bots: listFloorBots() });
    }
    if (req.method === 'POST') {
      const result = upsertFloorBot(req.body);
      if (result.error) return res.status(400).json({ error: result.error });
      return res.status(200).json({ bot: result.bot });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/floor/bots]', err);
    return res.status(500).json({ error: err.message || 'Floor API error' });
  }
}
