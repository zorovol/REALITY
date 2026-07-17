/** Five trading bots — one per AI agent. */

export const BOT_TYPES = ['chatgpt', 'grok', 'fable', 'gemini', 'deepseek'];

export const BOT_META = {
  chatgpt: {
    label: 'ChatGPT',
    desc: 'Volume leader — most-traded stock trackers.',
    color: '#00c805',
  },
  grok: {
    label: 'Grok',
    desc: 'Turnover hunter — hottest on-chain activity.',
    color: '#ff5000',
  },
  fable: {
    label: 'Fable',
    desc: 'Chaos mode — random stock picks.',
    color: '#fbbf24',
  },
  gemini: {
    label: 'Gemini',
    desc: 'Liquidity first — deepest Uniswap pools.',
    color: '#5ac8fa',
  },
  deepseek: {
    label: 'DeepSeek',
    desc: 'Thin pools — smaller liquidity bands.',
    color: '#8e8e93',
  },
};

export const LEGACY_BOT_TYPE = {
  sniper: 'chatgpt',
  momentum: 'grok',
  meme: 'fable',
  whale: 'gemini',
  lowcap: 'deepseek',
};

export function botMeta(botType) {
  const id = LEGACY_BOT_TYPE[botType] || botType;
  return BOT_META[id] ?? { label: botType, desc: '', color: '#A3A3A3', id };
}
