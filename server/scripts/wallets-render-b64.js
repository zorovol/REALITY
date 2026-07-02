#!/usr/bin/env node
/** Print WALLETS_ENC_B64 for Render env (encrypted blob — safe to store on Render). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'wallets.enc.json');
if (!fs.existsSync(file)) {
  console.error('Run npm run wallets:import first.');
  process.exit(1);
}
const b64 = Buffer.from(fs.readFileSync(file, 'utf8')).toString('base64');
console.log(b64);
