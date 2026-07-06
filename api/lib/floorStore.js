/** Public trading floor — named user bots (in-memory until DB). */

const bots = new Map();

export function listFloorBots() {
  return [...bots.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function upsertFloorBot(body) {
  const {
    botId, name, botType, walletAddress, isActive, tradingRules, position,
  } = body ?? {};

  if (!botId || !walletAddress || !botType) {
    return { error: 'Missing botId, walletAddress, or botType.' };
  }

  const trimmed = String(name || '').trim();
  if (trimmed.length < 2) {
    return { error: 'Name your bot (min 2 characters) to appear on the trading floor.' };
  }
  if (trimmed.length > 32) {
    return { error: 'Bot name max 32 characters.' };
  }

  const bot = {
    id: botId,
    name: trimmed,
    botType,
    walletAddress,
    isActive: Boolean(isActive),
    tradingRules: tradingRules ?? {},
    position: position ?? null,
    updatedAt: new Date().toISOString(),
  };
  bots.set(botId, bot);
  return { bot };
}

export function removeFloorBot(botId, walletAddress) {
  const existing = bots.get(botId);
  if (!existing) return { ok: true };
  if (existing.walletAddress !== walletAddress) {
    return { error: 'Not authorized to remove this bot.' };
  }
  bots.delete(botId);
  return { ok: true };
}
