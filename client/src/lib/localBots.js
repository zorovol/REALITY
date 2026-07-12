const BOTS_KEY = 'botforge_bots';

export const BOT_TYPES = ['chatgpt', 'grok', 'fable', 'gemini', 'deepseek'];

export function defaultTradingRules() {
  return {
    minMarketCap: 500,
    maxMarketCap: 500_000,
    buyAmountEth: 0.0005,
    buyAmountSol: 0.0005,
    takeProfitPercent: 8,
    stopLossPercent: 5,
  };
}

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(BOTS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(map) {
  localStorage.setItem(BOTS_KEY, JSON.stringify(map));
}

function userBots(walletAddress) {
  const all = readAll();
  if (!all[walletAddress]) all[walletAddress] = [];
  return all[walletAddress];
}

export function listBots(walletAddress) {
  return userBots(walletAddress);
}

export function createBot(walletAddress, { name, botType, tradingRules }) {
  const all = readAll();
  const bots = userBots(walletAddress);
  const bot = {
    id: crypto.randomUUID(),
    name: String(name || '').trim(),
    botType,
    tradingRules: { ...defaultTradingRules(), ...tradingRules },
    isActive: false,
    position: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  bots.unshift(bot);
  all[walletAddress] = bots;
  writeAll(all);
  return bot;
}

export function updateBot(walletAddress, botId, patch) {
  const all = readAll();
  const bots = userBots(walletAddress);
  const idx = bots.findIndex((b) => b.id === botId);
  if (idx === -1) return null;
  bots[idx] = { ...bots[idx], ...patch, updatedAt: new Date().toISOString() };
  all[walletAddress] = bots;
  writeAll(all);
  return bots[idx];
}

export function deleteBot(walletAddress, botId) {
  const all = readAll();
  const bots = userBots(walletAddress).filter((b) => b.id !== botId);
  all[walletAddress] = bots;
  writeAll(all);
}
