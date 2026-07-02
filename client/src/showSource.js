import { io } from 'socket.io-client';
import { LocalShow } from './sim/director.js';

/**
 * Show source manager.
 * Tries the live show server first (same origin, or VITE_SERVER_URL when the
 * frontend is hosted separately, e.g. on Vercel). If no server responds
 * within the timeout — or the connection errors — a full local simulation of
 * the show starts in the browser so the app ALWAYS loads. If a real server
 * shows up later, we switch to it seamlessly.
 */

const SERVER_URL = import.meta.env.VITE_SERVER_URL || undefined;
const FALLBACK_AFTER_MS = 6000;

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

export function getMode() {
  return mode;
}

function notifyStatus() {
  dispatch('source:change', { mode, connected: mode === 'server' ? socket.connected : mode === 'local' });
}

function startLocal() {
  if (mode === 'server' || sim) return;
  console.warn('[show] No show server reachable — starting local island simulation.');
  mode = 'local';
  sim = new LocalShow(dispatch);
  sim.start();
  notifyStatus();
}

function switchToServer() {
  if (mode === 'server') return;
  mode = 'server';
  if (sim) {
    sim.stop();
    sim = null;
  }
  notifyStatus();
}

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  timeout: 5000,
  reconnectionDelayMax: 15000,
});

socket.onAny((event, payload) => {
  // The server always sends game:state first — that's our signal it's real.
  if (event === 'game:state') switchToServer();
  if (mode === 'local') return; // ignore stray server chatter while simulating
  dispatch(event, payload);
});

socket.on('connect', notifyStatus);
socket.on('disconnect', () => {
  notifyStatus();
  // Server went away mid-broadcast: give it a grace period, then take over locally
  setTimeout(() => {
    if (!socket.connected && mode !== 'local') {
      mode = 'connecting';
      startLocal();
    }
  }, FALLBACK_AFTER_MS);
});
socket.on('connect_error', () => {
  if (mode === 'connecting') startLocal();
});

// Hard deadline: never leave the audience staring at a boot screen
setTimeout(() => {
  if (mode === 'connecting') startLocal();
}, FALLBACK_AFTER_MS);

export function castVote(contestantId, cb) {
  if (mode === 'local' && sim) {
    cb?.(sim.castVote(VOTER_ID, contestantId));
    return;
  }
  if (!socket.connected) {
    cb?.({ ok: false, error: 'Not connected to the broadcast.' });
    return;
  }
  socket.emit('vote:cast', { voterId: VOTER_ID, contestantId }, cb);
}
