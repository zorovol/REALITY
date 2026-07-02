import { io } from 'socket.io-client';
import { WorldEngine } from './sim/world.js';
import { personaLine } from './sim/persona.js';
import { buildFallbackMarket } from './lib/marketState.js';

/**
 * Show source manager.
 * Local dev: Vite proxies /api + /socket.io to localhost:4000 (same origin).
 * Production: Vercel rewrites /api + /socket.io to Render (same origin, any custom domain).
 * Never call Render directly from the browser — CORS is restricted to known frontends.
 */

function isLocalDev() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

/** Same-origin in all deployed builds; explicit URL only for non-proxied staging. */
function resolveServerUrl() {
  if (isLocalDev()) return undefined;
  return undefined;
}

const SERVER_URL = resolveServerUrl();
const FALLBACK_AFTER_MS = 30000;
const HARD_DEADLINE_MS = 45000;
const HTTP_TIMEOUT_MS = 25000;
const SIM_STORE_KEY = 'adi-world-v6';

// Stable per-browser voter identity
const KEY = 'adi-voter-id';
let voterId;
try {
  voterId = localStorage.getItem(KEY);
  if (!voterId) {
    voterId = `viewer-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    localStorage.setItem(KEY, voterId);
  }
} catch {
  voterId = `viewer-${Math.random().toString(36).slice(2, 10)}`;
}
export const VOTER_ID = voterId;

const listeners = new Map();

export function on(event, cb) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(cb);
  return () => listeners.get(event)?.delete(cb);
}

function dispatch(event, payload) {
  listeners.get(event)?.forEach((cb) => {
    try { cb(payload); } catch (err) { console.error('[show] listener error:', err); }
  });
}

let mode = 'connecting'; // 'connecting' | 'server' | 'local'
let sim = null;
let booted = false;
let fallbackTimer = null;
let hardDeadlineTimer = null;

export function getMode() {
  return mode;
}

function notifyStatus(extra = {}) {
  dispatch('source:change', {
    mode,
    connected: mode === 'server' ? socket.connected : mode === 'local',
    booted,
    ...extra,
  });
}

function markBooted() {
  if (booted) return;
  booted = true;
  notifyStatus();
}

function ingestServerState(state) {
  if (!state) return false;
  switchToServer();
  dispatch('world:state', state);
  if (state.market) {
    dispatch('market:update', state.market);
  } else if (state.agents?.length) {
    dispatch('market:update', buildFallbackMarket({ agents: state.agents, mode: 'real' }));
  }
  markBooted();
  return true;
}

async function tryHttpBootstrap() {
  try {
    const res = await fetch('/api/state', { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    if (!res.ok) return false;
    const state = await res.json();
    return ingestServerState(state);
  } catch (err) {
    console.warn('[show] HTTP bootstrap failed:', err?.message ?? err);
    return false;
  }
}

function startLocal(reason = 'timeout') {
  if (mode === 'server' || sim) return;
  console.warn(`[show] Starting local simulation (${reason}).`);
  mode = 'local';
  try {
    sim = new WorldEngine({
      dispatch,
      gen: (agent, intent, ctx) => personaLine(intent, agent, ctx),
      save: (snapshot) => {
        try { localStorage.setItem(SIM_STORE_KEY, JSON.stringify(snapshot)); } catch { /* full/unavailable */ }
      },
      restore: () => {
        try { return JSON.parse(localStorage.getItem(SIM_STORE_KEY) ?? 'null'); } catch { return null; }
      },
    });
    sim.start();
    markBooted();
  } catch (err) {
    console.error('[show] Local sim failed:', err);
    dispatch('world:state', {
      startedAt: Date.now(),
      arc: null,
      tension: 0,
      zones: [],
      agents: [],
      alliances: [],
      feed: [],
      timeline: [],
      voting: null,
    });
    dispatch('market:update', buildFallbackMarket({ mode: 'local' }));
    dispatch('source:change', { mode: 'local', connected: true, booted: true, error: err.message });
    booted = true;
  }
  notifyStatus({ reason });
}

async function activateFallback(reason) {
  if (mode === 'server' || booted) return;
  const ok = await tryHttpBootstrap();
  if (!ok) startLocal(reason);
}

function switchToServer() {
  if (mode === 'server') return;
  mode = 'server';
  if (sim) {
    sim.stop();
    sim = null;
  }
  try { localStorage.removeItem(SIM_STORE_KEY); } catch { /* unavailable */ }
  notifyStatus();
}

const socket = io(SERVER_URL, {
  transports: ['polling', 'websocket'],
  timeout: 20000,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelayMax: 15000,
});

socket.onAny((event, payload) => {
  if (event === 'world:state') {
    ingestServerState(payload);
    return;
  }
  if (mode === 'local') return;
  dispatch(event, payload);
});

socket.on('connect', () => {
  notifyStatus();
  if (mode === 'local') {
    void tryHttpBootstrap();
    return;
  }
  if (!booted) {
    setTimeout(() => {
      if (!booted && mode !== 'local') void tryHttpBootstrap();
    }, 1500);
  }
});

socket.on('disconnect', () => {
  notifyStatus();
  setTimeout(() => {
    if (!socket.connected && mode === 'server') {
      mode = 'connecting';
      activateFallback('disconnect');
    }
  }, FALLBACK_AFTER_MS);
});

socket.on('connect_error', (err) => {
  console.warn('[show] Socket connect_error:', err?.message ?? err);
  if (mode === 'connecting') activateFallback('connect_error');
});

fallbackTimer = setTimeout(() => {
  if (!booted) activateFallback('timeout');
}, FALLBACK_AFTER_MS);

hardDeadlineTimer = setTimeout(() => {
  if (!booted) startLocal('hard_deadline');
}, HARD_DEADLINE_MS);

if (!isLocalDev()) {
  void tryHttpBootstrap();
  setInterval(() => {
    if (mode === 'local') void tryHttpBootstrap();
  }, 12000);
}

export function castVote(contestantId, cb) {
  if (mode === 'local' && sim) {
    cb?.(sim.castAudienceVote(VOTER_ID, contestantId));
    return;
  }
  if (!socket.connected) {
    cb?.({ ok: false, error: 'Not connected to the broadcast.' });
    return;
  }
  socket.emit('vote:cast', { voterId: VOTER_ID, contestantId }, cb);
}
