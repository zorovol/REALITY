import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { config } from '../config.js';
import { requireAuth } from './routes.js';

const connection = new Connection(config.solanaRpcUrl, 'confirmed');

export function mountWalletRoutes(app) {
  app.get('/api/wallet/balance', requireAuth, async (req, res) => {
    try {
      const bal = await connection.getBalance(new PublicKey(req.user.walletAddress));
      res.json({ balanceSol: bal / LAMPORTS_PER_SOL, walletAddress: req.user.walletAddress });
    } catch (err) {
      console.error('[wallet] balance error:', err.message);
      res.status(500).json({ error: 'Failed to fetch balance.' });
    }
  });
}
