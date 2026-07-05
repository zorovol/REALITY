import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PASSWORD_SALT_BYTES = 16;
const USER_SALT_BYTES = 16;

function derivePasswordKey(password, salt) {
  return scryptSync(password, salt, 32);
}

export function hashPassword(password) {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function encryptWithPassword(secretKeyBase58, password, userSaltHex) {
  const salt = Buffer.from(userSaltHex, 'hex');
  const key = derivePasswordKey(password, salt);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(secretKeyBase58, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function encryptWithServerKey(secretKeyBase58, serverKey) {
  if (!serverKey || serverKey.length < 16) {
    throw new Error('AUTH_SERVER_KEY must be at least 16 characters.');
  }
  const key = scryptSync(serverKey, 'adi-user-wallet-v1', 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(secretKeyBase58, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function newUserSalt() {
  return randomBytes(USER_SALT_BYTES).toString('hex');
}
