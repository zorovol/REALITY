import { requireAuth } from '../auth/routes.js';
import {
  createBot,
  listBotsForUser,
  findBot,
  updateBot,
  deleteBot,
  listBotTrades,
} from '../auth/store.js';
import { BOT_TYPES, defaultTradingRules, normalizeRules } from './strategies.js';
import { getUserBotEngine } from './engineHolder.js';
import { config } from '../config.js';

export function mountBotRoutes(app) {
  app.get('/api/bots/types', (_req, res) => {
    res.json({ types: BOT_TYPES, defaultRules: defaultTradingRules() });
  });

  app.get('/api/bots', requireAuth, async (req, res) => {
    const bots = await listBotsForUser(req.user.id);
    res.json({ bots: bots.map(publicBot) });
  });

  app.post('/api/bots', requireAuth, async (req, res) => {
    try {
      const { botType, tradingRules, name } = req.body ?? {};
      if (!BOT_TYPES.includes(botType)) {
        return res.status(400).json({ error: `Invalid bot type. Choose: ${BOT_TYPES.join(', ')}` });
      }
      const rules = normalizeRules(tradingRules);
      if (rules.minMarketCap >= rules.maxMarketCap) {
        return res.status(400).json({ error: 'minMarketCap must be less than maxMarketCap.' });
      }
      const bot = await createBot({ userId: req.user.id, name, botType, tradingRules: rules });
      res.status(201).json({ bot: publicBot(bot) });
    } catch (err) {
      console.error('[bots] create error:', err.message);
      res.status(500).json({ error: 'Failed to create bot.' });
    }
  });

  app.patch('/api/bots/:id', requireAuth, async (req, res) => {
    try {
      const bot = await findBot(req.params.id, req.user.id);
      if (!bot) return res.status(404).json({ error: 'Bot not found.' });

      const patch = {};
      if (req.body?.botType !== undefined) {
        if (!BOT_TYPES.includes(req.body.botType)) {
          return res.status(400).json({ error: 'Invalid bot type.' });
        }
        patch.botType = req.body.botType;
      }
      if (req.body?.tradingRules !== undefined) {
        patch.tradingRules = normalizeRules(req.body.tradingRules);
      }
      if (req.body?.name !== undefined) {
        patch.name = String(req.body.name).trim();
      }
      if (req.body?.isActive !== undefined) {
        patch.isActive = Boolean(req.body.isActive);
      }

      const updated = await updateBot(bot.id, req.user.id, patch);
      res.json({ bot: publicBot(updated) });
    } catch (err) {
      console.error('[bots] update error:', err.message);
      res.status(500).json({ error: 'Failed to update bot.' });
    }
  });

  app.post('/api/bots/:id/start', requireAuth, async (req, res) => {
    if (!req.user.serverEncryptedKey) {
      return res.status(400).json({
        error: 'Wallet not synced for trading. Log out and log in again to re-sync your wallet.',
      });
    }
    const updated = await updateBot(req.params.id, req.user.id, { isActive: true });
    if (!updated) return res.status(404).json({ error: 'Bot not found.' });
    res.json({ bot: publicBot(updated) });
  });

  app.post('/api/bots/:id/stop', requireAuth, async (req, res) => {
    const updated = await updateBot(req.params.id, req.user.id, { isActive: false });
    if (!updated) return res.status(404).json({ error: 'Bot not found.' });
    res.json({ bot: publicBot(updated) });
  });

  app.delete('/api/bots/:id', requireAuth, async (req, res) => {
    const ok = await deleteBot(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Bot not found.' });
    res.json({ ok: true });
  });

  app.post('/api/bots/:id/clear-position', requireAuth, async (req, res) => {
    const updated = await updateBot(req.params.id, req.user.id, { position: null });
    if (!updated) return res.status(404).json({ error: 'Bot not found.' });
    res.json({ bot: publicBot(updated) });
  });

  app.get('/api/bots/trading-diagnostics', requireAuth, async (req, res) => {
    const engine = getUserBotEngine();
    if (!engine) {
      return res.json({
        engineRunning: false,
        simulationFallback: config.simulationFallback,
        authConfigured: Boolean(config.authServerKey),
        tradingReady: Boolean(req.user.serverEncryptedKey),
        message: 'User bot engine not running on this server instance.',
      });
    }
    const diag = await engine.getDiagnostics(req.user.id);
    res.json({ ...diag, tradingReady: Boolean(req.user.serverEncryptedKey) });
  });

  app.get('/api/bots/:id/trades', requireAuth, async (req, res) => {
    const bot = await findBot(req.params.id, req.user.id);
    if (!bot) return res.status(404).json({ error: 'Bot not found.' });
    const trades = await listBotTrades(bot.id, req.user.id);
    res.json({ trades });
  });
}

function publicBot(bot) {
  return {
    id: bot.id,
    name: bot.name ?? '',
    botType: bot.botType,
    tradingRules: bot.tradingRules,
    isActive: bot.isActive,
    position: bot.position,
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
  };
}
