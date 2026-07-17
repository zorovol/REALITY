/** Five trading bots — one per AI agent on the live floor. */

export const BOT_TYPES = ['chatgpt', 'grok', 'fable', 'gemini', 'deepseek'];

export const BOT_META = {
  chatgpt: {
    label: 'ChatGPT',
    desc: 'Volume leader — most-traded stock tokens (NVDA, TSLA…).',
    color: '#00c805',
  },
  grok: {
    label: 'Grok',
    desc: 'Turnover hunter — stocks with hottest on-chain activity.',
    color: '#fb7185',
  },
  fable: {
    label: 'Fable',
    desc: 'Chaos mode — random stock token picks.',
    color: '#fbbf24',
  },
  gemini: {
    label: 'Gemini',
    desc: 'Blue chips — biggest on-chain caps in your range.',
    color: '#a78bfa',
  },
  deepseek: {
    label: 'DeepSeek',
    desc: 'Small caps — thinnest stock pools in your band.',
    color: '#38bdf8',
  },
};

/** Old strategy ids → AI names (existing saved bots). */
export const LEGACY_BOT_TYPE = {
  sniper: 'chatgpt',
  momentum: 'grok',
  meme: 'fable',
  whale: 'gemini',
  lowcap: 'deepseek',
};

export function botMeta(botType) {
  const id = LEGACY_BOT_TYPE[botType] || botType;
  return BOT_META[id] ?? { label: botType, desc: '', color: '#94a3b8', id };
}
