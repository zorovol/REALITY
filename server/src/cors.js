import { config } from './config.js';

/** CORS allowlist: comma-separated origins, or * for all. Allows any *.vercel.app preview when main Vercel URL is listed. */
export function corsOriginCheck(origin, callback) {
  const raw = config.clientOrigin;
  if (!raw || raw === '*') return callback(null, true);
  if (!origin) return callback(null, true);

  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.includes(origin)) return callback(null, true);
  if (allowed.some((o) => o.includes('vercel.app')) && /\.vercel\.app$/.test(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`CORS blocked: ${origin}`));
}

export function socketCors() {
  const raw = config.clientOrigin;
  if (!raw || raw === '*') return { origin: '*', methods: ['GET', 'POST'] };
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    origin: (origin, cb) => corsOriginCheck(origin, cb),
    methods: ['GET', 'POST'],
  };
}
