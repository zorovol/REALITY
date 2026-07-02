import { config } from './config.js';

const PRODUCTION_ORIGINS = [
  'https://gptgrokgeminideepseekfable.com',
  'https://www.gptgrokgeminideepseekfable.com',
  'https://ai-drama-island.vercel.app',
];

function isAllowedOrigin(origin, allowed) {
  if (allowed.includes(origin)) return true;
  if (allowed.some((o) => o.includes('vercel.app')) && /\.vercel\.app$/.test(origin)) {
    return true;
  }
  if (allowed.some((o) => o.includes('gptgrokgeminideepseekfable.com'))
    && /^https:\/\/([a-z0-9-]+\.)?gptgrokgeminideepseekfable\.com$/.test(origin)) {
    return true;
  }
  return false;
}

/** CORS allowlist: comma-separated origins in CLIENT_ORIGIN, plus known production domains. */
export function corsOriginCheck(origin, callback) {
  const raw = config.clientOrigin;
  if (!raw || raw === '*') return callback(null, true);
  if (!origin) return callback(null, true);

  const allowed = [...PRODUCTION_ORIGINS, ...raw.split(',').map((s) => s.trim()).filter(Boolean)];
  if (isAllowedOrigin(origin, allowed)) return callback(null, true);
  return callback(new Error(`CORS blocked: ${origin}`));
}

export function socketCors() {
  const raw = config.clientOrigin;
  if (!raw || raw === '*') return { origin: '*', methods: ['GET', 'POST'] };
  return {
    origin: (origin, cb) => corsOriginCheck(origin, cb),
    methods: ['GET', 'POST'],
  };
}
