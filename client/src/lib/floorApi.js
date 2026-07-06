async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Floor request failed (${res.status})`);
  return data;
}

export async function fetchFloorBots() {
  const data = await request('/api/floor/bots');
  return data.bots ?? [];
}

export async function publishFloorBot(bot, walletAddress) {
  const name = String(bot.name || '').trim();
  if (name.length < 2) return null;
  return request('/api/floor/bots', {
    method: 'POST',
    body: JSON.stringify({
      botId: bot.id,
      name,
      botType: bot.botType,
      walletAddress,
      isActive: bot.isActive,
      tradingRules: bot.tradingRules,
      position: bot.position,
    }),
  });
}

export async function unpublishFloorBot(botId, walletAddress) {
  return request(`/api/floor/bots/${botId}`, {
    method: 'DELETE',
    body: JSON.stringify({ walletAddress }),
  });
}

export async function syncFloorBot(bot, walletAddress) {
  const name = String(bot.name || '').trim();
  if (name.length < 2) {
    try {
      await unpublishFloorBot(bot.id, walletAddress);
    } catch {
      /* not on floor */
    }
    return null;
  }
  return publishFloorBot(bot, walletAddress);
}
