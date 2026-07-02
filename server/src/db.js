import pg from 'pg';
import { config } from './config.js';

/**
 * Persistence layer.
 * - With DATABASE_URL (Neon / Vercel Postgres): full write-through persistence.
 * - Without it: in-memory no-op store so the show still runs (state resets on restart).
 */

let pool = null;
let ready = false;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS seasons (
  number      INT PRIMARY KEY,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS contestants (
  id          TEXT PRIMARY KEY,
  season      INT NOT NULL,
  name        TEXT NOT NULL,
  model_label TEXT NOT NULL,
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS episodes (
  season      INT NOT NULL,
  number      INT NOT NULL,
  phase       TEXT NOT NULL,
  state       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season, number)
);

CREATE TABLE IF NOT EXISTS events (
  id          BIGSERIAL PRIMARY KEY,
  season      INT NOT NULL,
  episode     INT NOT NULL,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS votes (
  id            BIGSERIAL PRIMARY KEY,
  season        INT NOT NULL,
  episode       INT NOT NULL,
  contestant_id TEXT NOT NULL,
  mode          TEXT NOT NULL,
  voter_id      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relationships (
  season      INT NOT NULL,
  from_id     TEXT NOT NULL,
  to_id       TEXT NOT NULL,
  trust       REAL NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season, from_id, to_id)
);

CREATE TABLE IF NOT EXISTS snapshots (
  id          INT PRIMARY KEY DEFAULT 1,
  state       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function initDb() {
  if (!config.databaseUrl) {
    console.log('[db] No DATABASE_URL — running with in-memory persistence.');
    return false;
  }
  try {
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
    await pool.query(SCHEMA);
    ready = true;
    console.log('[db] Connected to Neon PostgreSQL, schema ready.');
    return true;
  } catch (err) {
    console.error('[db] Connection failed, falling back to in-memory:', err.message);
    pool = null;
    ready = false;
    return false;
  }
}

export function dbReady() {
  return ready;
}

async function safeQuery(text, params) {
  if (!ready) return null;
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('[db] query error:', err.message);
    return null;
  }
}

export async function loadSnapshot() {
  const res = await safeQuery('SELECT state FROM snapshots WHERE id = 1');
  return res?.rows?.[0]?.state ?? null;
}

export async function saveSnapshot(state) {
  await safeQuery(
    `INSERT INTO snapshots (id, state, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET state = $1, updated_at = now()`,
    [state]
  );
}

export async function upsertSeason(number) {
  await safeQuery(
    `INSERT INTO seasons (number) VALUES ($1) ON CONFLICT (number) DO NOTHING`,
    [number]
  );
}

export async function endSeason(number) {
  await safeQuery(`UPDATE seasons SET ended_at = now() WHERE number = $1`, [number]);
}

export async function upsertContestant(season, c) {
  await safeQuery(
    `INSERT INTO contestants (id, season, name, model_label, data, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (id) DO UPDATE SET data = $5, updated_at = now()`,
    [c.id, season, c.name, c.modelLabel, c]
  );
}

export async function upsertEpisode(season, number, phase, state) {
  await safeQuery(
    `INSERT INTO episodes (season, number, phase, state, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (season, number) DO UPDATE SET phase = $3, state = $4, updated_at = now()`,
    [season, number, phase, state]
  );
}

export async function insertEvent(season, episode, type, payload) {
  await safeQuery(
    `INSERT INTO events (season, episode, type, payload) VALUES ($1, $2, $3, $4)`,
    [season, episode, type, payload]
  );
}

export async function insertVote(season, episode, contestantId, mode, voterId) {
  await safeQuery(
    `INSERT INTO votes (season, episode, contestant_id, mode, voter_id) VALUES ($1, $2, $3, $4, $5)`,
    [season, episode, contestantId, mode, voterId]
  );
}

export async function upsertRelationship(season, fromId, toId, trust) {
  await safeQuery(
    `INSERT INTO relationships (season, from_id, to_id, trust, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (season, from_id, to_id) DO UPDATE SET trust = $4, updated_at = now()`,
    [season, fromId, toId, trust]
  );
}
