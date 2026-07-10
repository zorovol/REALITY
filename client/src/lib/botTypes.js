/** Five trading bots — one per AI agent on the live floor. */

export const BOT_TYPES = ['chatgpt', 'grok', 'fable', 'gemini', 'deepseek'];

export const BOT_META = {
  chatgpt: {
    label: 'ChatGPT',
    desc: 'New listings — first on fresh stock token pools.',
    color: '#00c805',
  },
  grok: {
    label: 'Grok',
    desc: 'Volatility hunter — rides on-chain price spikes.',
    color: '#fb7185',
  },
  fable: {
    label: 'Fable',
    desc: 'Chaos mode — random stock picks.',
    color: '#fbbf24',
  },
  gemini: {
    label: 'Gemini',
    desc: 'Blue chips — larger notional at the top of your range.',
    color: '#a78bfa',
  },
  deepseek: {
    label: 'DeepSeek',
    desc: 'Value sniper — smallest notional in your band.',
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
