import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const SALT = 'adi-solana-wallets-v1';

export function deriveKey(secret) {
  if (!secret || secret.length < 16) {
    throw new Error('ENCRYPTION_KEY must be at least 16 characters.');
  }
  return scryptSync(secret, SALT, 32);
}

export function encrypt(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(blob, key) {
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
