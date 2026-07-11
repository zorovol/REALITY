/**
 * Verify DATABASE_URL connects and schema is ready.
 * Usage: DATABASE_URL=postgresql://... node scripts/db-check.js
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

const { initDb, dbStatus } = await import('../src/db.js');

const ok = await initDb();
const status = dbStatus();
console.log(JSON.stringify({ ok, ...status }, null, 2));
process.exit(ok ? 0 : 1);
