import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import {
  createUser,
  findUserByWallet,
  findUserById,
  createSession,
  findSession,
  deleteSession,
  createBot,
  listBotsForUser,
  findBot,
  updateBot,
  deleteBot,
  listBotTrades,
  updateUserKeys,
} from './store.js';
import {
  hashPassword,
  verifyPassword,
  encryptWithPassword,
  encryptWithServerKey,
  newUserSalt,
} from './crypto.js';
import { BOT_TYPES, defaultTradingRules, normalizeRules } from '../bots/strategies.js';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

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

export function sessionCookieHeader(token) {
  const maxAge = SESSION_DAYS * 86400;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

function newSessionToken() {
  return randomBytes(32).toString('hex');
}

function requireServerKey() {
  if (!config.authServerKey || config.authServerKey.length < 16) {
    return 'Server not configured for signup. Set AUTH_SERVER_KEY or ENCRYPTION_KEY on the backend.';
  }
  return null;
}

export async function getAuthUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = await findSession(token);
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user) return null;
  return { user, sessionToken: token };
}

export async function handleSignup(body) {
  const keyErr = requireServerKey();
  if (keyErr) return { status: 503, body: { error: keyErr } };

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
    serverEncryptedKey: encryptWithServerKey(secretKey, config.authServerKey),
  });

  const token = newSessionToken();
  await createSession(token, user.id, new Date(Date.now() + SESSION_DAYS * 86400_000));

  return {
    status: 201,
    cookie: sessionCookieHeader(token),
    body: {
      walletAddress: user.walletAddress,
      message: 'Account created. Your wallet address is your username.',
    },
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

  return {
    status: 200,
    cookie: sessionCookieHeader(token),
    body: { walletAddress: user.walletAddress, message: 'Logged in.' },
  };
}

/** Sync a browser-generated wallet to the server for automated trading. */
export async function handleRegisterWallet(body) {
  const keyErr = requireServerKey();
  if (keyErr) return { status: 503, body: { error: keyErr } };

  const { walletAddress, password, secretKey } = body ?? {};
  if (!walletAddress || !password || !secretKey) {
    return { status: 400, body: { error: 'walletAddress, password, and secretKey are required.' } };
  }
  if (password.length < 8) {
    return { status: 400, body: { error: 'Password must be at least 8 characters.' } };
  }

  try {
    new PublicKey(String(walletAddress).trim());
  } catch {
    return { status: 400, body: { error: 'Invalid Solana wallet address.' } };
  }

  const addr = String(walletAddress).trim();
  let user = await findUserByWallet(addr);

  if (user) {
    if (!verifyPassword(password, user.passwordHash)) {
      return { status: 401, body: { error: 'Wallet already registered with a different password.' } };
    }
    await updateUserKeys(user.id, {
      serverEncryptedKey: encryptWithServerKey(secretKey, config.authServerKey),
      encryptedPrivateKey: encryptWithPassword(secretKey, password, user.userSalt),
    });
  } else {
    const userSalt = newUserSalt();
    user = await createUser({
      walletAddress: addr,
      passwordHash: hashPassword(password),
      userSalt,
      encryptedPrivateKey: encryptWithPassword(secretKey, password, userSalt),
      serverEncryptedKey: encryptWithServerKey(secretKey, config.authServerKey),
    });
  }

  const token = newSessionToken();
  await createSession(token, user.id, new Date(Date.now() + SESSION_DAYS * 86400_000));

  return {
    status: 200,
    cookie: sessionCookieHeader(token),
    body: { walletAddress: user.walletAddress, message: 'Wallet synced — bots can trade on-chain.' },
  };
}

export async function handleLogout(auth) {
  if (!auth) return { status: 401, body: { error: 'Not authenticated.' } };
  await deleteSession(auth.sessionToken);
  return { status: 200, clearCookie: true, body: { ok: true } };
}

export async function handleMe(auth) {
  if (!auth) return { status: 401, body: { error: 'Not authenticated.' } };
  return {
    status: 200,
    body: {
      walletAddress: auth.user.walletAddress,
      createdAt: auth.user.createdAt,
      tradingReady: Boolean(auth.user.serverEncryptedKey),
    },
  };
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
  const { botType, tradingRules, name } = body ?? {};
  if (!BOT_TYPES.includes(botType)) {
    return { status: 400, body: { error: `Invalid bot type. Choose: ${BOT_TYPES.join(', ')}` } };
  }
  const rules = normalizeRules(tradingRules);
  if (rules.minMarketCap >= rules.maxMarketCap) {
    return { status: 400, body: { error: 'minMarketCap must be less than maxMarketCap.' } };
  }
  const bot = await createBot({ userId: auth.user.id, name, botType, tradingRules: rules });
  return { status: 201, body: { bot: publicBot(bot) } };
}

export async function handleUpdateBot(auth, botId, body) {
  if (!auth) return { status: 401, body: { error: 'Not authenticated.' } };
  const bot = await findBot(botId, auth.user.id);
  if (!bot) return { status: 404, body: { error: 'Bot not found.' } };

  const patch = {};
  if (body?.botType !== undefined) {
    if (!BOT_TYPES.includes(body.botType)) return { status: 400, body: { error: 'Invalid bot type.' } };
    patch.botType = body.botType;
  }
  if (body?.name !== undefined) patch.name = String(body.name).trim();
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
  const connection = new Connection(config.solanaRpcUrl, 'confirmed');
  const bal = await connection.getBalance(new PublicKey(auth.user.walletAddress));
  return {
    status: 200,
    body: { balanceSol: bal / LAMPORTS_PER_SOL, walletAddress: auth.user.walletAddress },
  };
}

function publicBot(bot) {
  return {
    id: bot.id,
    name: bot.name ?? '',
    botType: bot.botType,
    tradingRules: bot.tradingRules,
    isActive: bot.isActive,
    position: bot.position,
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
  };
}

export function sendJson(res, result) {
  if (result.cookie) res.setHeader('Set-Cookie', result.cookie);
  if (result.clearCookie) res.setHeader('Set-Cookie', clearSessionCookieHeader());
  res.status(result.status).json(result.body);
}
