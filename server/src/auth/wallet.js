import { requireAuth } from './routes.js';
import { handleWalletBalance, sendJson } from './handlers.js';

/** Ethereum ETH balance for the logged-in user wallet. */
export function mountWalletRoutes(app) {
  app.get('/api/wallet/balance', requireAuth, async (req, res) => {
    try {
      sendJson(res, await handleWalletBalance({ user: req.user }));
    } catch (err) {
      console.error('[wallet] balance error:', err.message);
      res.status(500).json({ error: 'Failed to fetch balance.' });
    }
  });
}
