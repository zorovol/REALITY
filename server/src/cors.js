import { config } from './config.js';

const PRODUCTION_ORIGINS = [
  'https://solvanta.fun',
  'https://www.solvanta.fun',
  'https://tickwire.app',
  'https://www.tickwire.app',
  'https://ai-drama-island.vercel.app',
];

function isLocalDevOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function isAllowedOrigin(origin, allowed) {
  if (isLocalDevOrigin(origin)) return true;
  if (allowed.includes(origin)) return true;
  if (allowed.some((o) => o.includes('vercel.app')) && /\.vercel\.app$/.test(origin)) {
    return true;
  }
  if (allowed.some((o) => o.includes('solvanta.fun'))
    && /^https:\/\/(www\.)?solvanta\.fun$/.test(origin)) {
    return true;
  }
  if (allowed.some((o) => o.includes('tickwire.app'))
    && /^https:\/\/(www\.)?tickwire\.app$/.test(origin)) {
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
