import { randomBytes } from 'node:crypto';
import { getAuthServerKey, getSolanaRpcUrl, isProduction } from './config.js';
import {
  createUser, findUserByWallet, findUserById, createSession, findSession, deleteSession,
  createBot, listBotsForUser, findBot, updateBot, deleteBot, listBotTrades,
  BOT_TYPES, defaultTradingRules, normalizeRules,
} from './store.js';
import { hashPassword, verifyPassword, encryptWithPassword, encryptWithServerKey, newUserSalt } from './crypto.js';

const SESSION_COOKIE = 'adi_session';
const SESSION_DAYS = 7;

export function parseCookies(req) {
  const header = req.headers?.cookie || req.headers?.Cookie || '';
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [k, ...v] = part.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    }).filter(([k]) => k),
  );
}

function sessionCookieHeader(token) {
  const maxAge = SESSION_DAYS * 86400;
  const secure = isProduction() ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

function newSessionToken() {
  return randomBytes(32).toString('hex');
}

export async function getAuthUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const session = await findSession(token);
  if (!session) return null;
  const user = await findUserById(session.userId);
  return user ? { user, sessionToken: token } : null;
}

export async function handleSignup(body) {
  const authServerKey = getAuthServerKey();
  if (!authServerKey || authServerKey.length < 16) {
    return { status: 503, body: { error: 'Server not configured. Set AUTH_SERVER_KEY in Vercel env vars.' } };
  }
  const { password } = body ?? {};
  if (!password || typeof password !== 'string' || password.length < 8) {
    return { status: 400, body: { error: 'Password must be at least 8 characters.' } };
  }

  const { Keypair } = await import('@solana/web3.js');
  const bs58 = (await import('bs58')).default;
  const keypair = Keypair.generate();
  const walletAddress = keypair.publicKey.toBase58();
  const secretKey = bs58.encode(keypair.secretKey);
  const userSalt = newUserSalt();

  const user = await createUser({
    walletAddress,
    passwordHash: hashPassword(password),
    userSalt,
    encryptedPrivateKey: encryptWithPassword(secretKey, password, userSalt),
    serverEncryptedKey: encryptWithServerKey(secretKey, authServerKey),
  });

  const token = newSessionToken();
  await createSession(token, user.id, new Date(Date.now() + SESSION_DAYS * 86400_000));

  return {
    status: 201,
    cookie: sessionCookieHeader(token),
    body: { walletAddress: user.walletAddress, message: 'Account created.' },
  };
}

export async function handleLogin(body) {
  const { username, password } = body ?? {};
  if (!username || !password) {
    return { status: 400, body: { error: 'Wallet address and password required.' } };
  }
  const user = await findUserByWallet(String(username).trim());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { status: 401, body: { error: 'Invalid wallet address or password.' } };
  }
  const token = newSessionToken();
  await createSession(token, user.id, new Date(Date.now() + SESSION_DAYS * 86400_000));
  return { status: 200, cookie: sessionCookieHeader(token), body: { walletAddress: user.walletAddress } };
}

export async function handleLogout(auth) {
  if (!auth) return { status: 401, body: { error: 'Not authenticated.' } };
  await deleteSession(auth.sessionToken);
  return { status: 200, clearCookie: true, body: { ok: true } };
}

export async function handleMe(auth) {
  if (!auth) return { status: 401, body: { error: 'Not authenticated.' } };
  return { status: 200, body: { walletAddress: auth.user.walletAddress, createdAt: auth.user.createdAt } };
}

export async function handleBotTypes() {
  return { status: 200, body: { types: BOT_TYPES, defaultRules: defaultTradingRules() } };
}

export async function handleListBots(auth) {
  if (!auth) return { status: 401, body: { error: 'Not authenticated.' } };
  const bots = await listBotsForUser(auth.user.id);
  return { status: 200, body: { bots: bots.map(publicBot) } };
}

export async function handleCreateBot(auth, body) {
  if (!auth) return { status: 401, body: { error: 'Not authenticated.' } };
  const { botType, tradingRules } = body ?? {};
  if (!BOT_TYPES.includes(botType)) {
    return { status: 400, body: { error: `Invalid bot type.` } };
  }
  const rules = normalizeRules(tradingRules);
  const bot = await createBot({ userId: auth.user.id, botType, tradingRules: rules });
  return { status: 201, body: { bot: publicBot(bot) } };
}

export async function handleUpdateBot(auth, botId, body) {
  if (!auth) return { status: 401, body: { error: 'Not authenticated.' } };
  const bot = await findBot(botId, auth.user.id);
  if (!bot) return { status: 404, body: { error: 'Bot not found.' } };
  const patch = {};
  if (body?.botType !== undefined) patch.botType = body.botType;
  if (body?.tradingRules !== undefined) patch.tradingRules = normalizeRules(body.tradingRules);
  if (body?.isActive !== undefined) patch.isActive = Boolean(body.isActive);
  const updated = await updateBot(bot.id, auth.user.id, patch);
  return { status: 200, body: { bot: publicBot(updated) } };
}

export async function handleStartBot(auth, botId) {
  if (!auth) return { status: 401, body: { error: 'Not authenticated.' } };
  const updated = await updateBot(botId, auth.user.id, { isActive: true });
  if (!updated) return { status: 404, body: { error: 'Bot not found.' } };
  return { status: 200, body: { bot: publicBot(updated) } };
}

export async function handleStopBot(auth, botId) {
  if (!auth) return { status: 401, body: { error: 'Not authenticated.' } };
  const updated = await updateBot(botId, auth.user.id, { isActive: false });
  if (!updated) return { status: 404, body: { error: 'Bot not found.' } };
  return { status: 200, body: { bot: publicBot(updated) } };
}

export async function handleDeleteBot(auth, botId) {
  if (!auth) return { status: 401, body: { error: 'Not authenticated.' } };
  const ok = await deleteBot(botId, auth.user.id);
  if (!ok) return { status: 404, body: { error: 'Bot not found.' } };
  return { status: 200, body: { ok: true } };
}

export async function handleBotTrades(auth, botId) {
  if (!auth) return { status: 401, body: { error: 'Not authenticated.' } };
  const bot = await findBot(botId, auth.user.id);
  if (!bot) return { status: 404, body: { error: 'Bot not found.' } };
  const trades = await listBotTrades(bot.id, auth.user.id);
  return { status: 200, body: { trades } };
}

export async function handleWalletBalance(auth) {
  if (!auth) return { status: 401, body: { error: 'Not authenticated.' } };
  const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
  const connection = new Connection(getSolanaRpcUrl(), 'confirmed');
  const bal = await connection.getBalance(new PublicKey(auth.user.walletAddress));
  return { status: 200, body: { balanceSol: bal / LAMPORTS_PER_SOL, walletAddress: auth.user.walletAddress } };
}

function publicBot(bot) {
  return {
    id: bot.id, botType: bot.botType, tradingRules: bot.tradingRules,
    isActive: bot.isActive, position: bot.position,
    createdAt: bot.createdAt, updatedAt: bot.updatedAt,
  };
}

export function sendJson(res, result) {
  if (result.cookie) res.setHeader('Set-Cookie', result.cookie);
  if (result.clearCookie) res.setHeader('Set-Cookie', clearSessionCookieHeader());
  res.status(result.status).json(result.body);
}

export async function initOnce() {
  const { initStore } = await import('./store.js');
  await initStore();
}
