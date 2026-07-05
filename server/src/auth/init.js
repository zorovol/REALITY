import { initDb } from '../db.js';
import { initPlatformStore } from './store.js';

let ready = false;

export async function initPlatformOnce() {
  if (ready) return;
  await initDb();
  await initPlatformStore();
  ready = true;
}
