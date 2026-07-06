import express from 'express';
import http from 'node:http';
import cors from 'cors';
import multer from 'multer';
import { Server } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initDb, dbReady, saveSnapshot, loadSnapshot, insertEvent, insertVote } from './db.js';
import { initPlatformStore } from './auth/store.js';
import { mountAuthRoutes } from './auth/routes.js';
import { mountWalletRoutes } from './auth/wallet.js';
import { mountBotRoutes } from './bots/routes.js';
import { UserBotEngine } from './bots/engine.js';
import { setUserBotEngine } from './bots/engineHolder.js';
import { WorldEngine } from './engine/world.js';
import { speak } from './ai/brain.js';
import { personaLine } from './ai/persona.js';
import { availableProviders, assignProvider } from './ai/providers.js';
import { PumpService } from './solana/pump.js';
import { WalletManager } from './solana/wallets.js';
import { TradingEngine } from './solana/trading.js';
import { solanaConfig } from './solana/config.js';
import { buildSkeletonMarket } from './solana/marketFallback.js';
import { corsOriginCheck, socketCors } from './cors.js';
import { mergeImagesWithModel } from './ai/imageMerge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: socketCors(),
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
});

app.use(cors({ origin: corsOriginCheck, credentials: true }));
app.use(express.json());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pump = new PumpService(solanaConfig.rpcUrl);
const wallets = new WalletManager({ connection: pump.connection });

let trading = null;
let userBotEngine = null;

const world = new WorldEngine({
  speed: config.speed,
  dispatch: (event, payload) => {
    io.emit(event, payload);
    if (event === 'feed:item' && payload.kind !== 'system') {
      insertEvent(1, world.arcNumber, payload.kind, payload);
    }
    if (event === 'trade:item' && payload.signature) {
      insertEvent(1, world.arcNumber, 'trade', payload);
    }
  },
  gen: async (agent, intent, ctx, w) => {
    if (!agent.provider || agent.provider === 'persona') return personaLine(intent, agent, ctx);
    const line = await Promise.race([speak(agent, w, intent, ctx), sleep(3000).then(() => null)]);
    return line ?? personaLine(intent, agent, ctx);
  },
  save: (snapshot) => saveSnapshot(snapshot),
  restore: async () => await loadSnapshot(),
});

function publicState() {
  const base = world.serialize();
  const walletMap = wallets.allPublicWallets();
  const market = trading?.getMarketState() ?? buildSkeletonMarket(walletMap);
  return {
    ...base,
    market,
    agents: base.agents.map((a) => trading ? trading.enrichAgent(a) : { ...a, wallet: wallets.getPublicWallet(a.id) }),
  };
}

mountAuthRoutes(app);
mountWalletRoutes(app);
mountBotRoutes(app);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    db: dbReady() ? 'neon' : 'memory',
    platformAuth: true,
    aiProviders: availableProviders().map((p) => p.id),
    arc: world.arc,
    tension: Math.round(world.tension),
    population: world.activeAgents().length,
    voting: !!world.voting,
    solana: {
      network: solanaConfig.network,
      mode: solanaConfig.simulationFallback ? 'simulation_fallback' : 'real',
    },
  });
});

app.get('/api/state', (req, res) => {
  res.json(publicState());
});

app.get('/api/wallets', (req, res) => {
  res.json({
    network: solanaConfig.network,
    mode: solanaConfig.simulationFallback ? 'simulation_fallback' : 'real',
    minSolRecommended: solanaConfig.minSolForTrade,
    disclaimer: 'Fund these addresses with SOL. Private keys never leave the server.',
    wallets: wallets.allPublicWallets(),
  });
});

app.get('/api/market', (req, res) => {
  res.json(trading?.getMarketState() ?? buildSkeletonMarket(wallets.allPublicWallets()));
});

app.get('/api/trades', (req, res) => {
  res.json(trading?.getTradesByAgent() ?? {});
});

app.get('/api/trades/:agentId', (req, res) => {
  const id = req.params.agentId?.toLowerCase();
  if (!id) return res.status(400).json({ error: 'agentId required' });
  res.json({
    agentId: id,
    trades: trading?.getTradesForAgent(id) ?? [],
  });
});

app.post('/api/face-merge', upload.fields([
  { name: 'face', maxCount: 1 },
  { name: 'template', maxCount: 1 },
]), async (req, res) => {
  try {
    const faceFile = req.files?.face?.[0];
    const templateFile = req.files?.template?.[0];

    if (!faceFile || !templateFile) {
      return res.status(400).json({ error: 'Both face and template images are required.' });
    }

    const result = await mergeImagesWithModel({ faceFile, templateFile });
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    console.error('[face-merge] failed:', err.message);
    return res.status(status).json({ error: err.message || 'Image merge failed.' });
  }
});

// Serve the built client in production (single-deploy setup)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

io.on('connection', (socket) => {
  socket.emit('world:state', publicState());
  if (world.voting) socket.emit('vote:open', world.publicVoting());
  io.emit('audience:count', io.engine.clientsCount);

  socket.on('vote:cast', ({ voterId, contestantId }, ack) => {
    if (typeof voterId !== 'string' || typeof contestantId !== 'string') {
      return ack?.({ ok: false, error: 'Invalid vote payload.' });
    }
    const result = world.castAudienceVote(voterId.slice(0, 64), contestantId);
    if (result.ok) insertVote(1, world.arcNumber, contestantId, 'eliminate', voterId.slice(0, 64));
    ack?.(result);
  });

  socket.on('disconnect', () => io.emit('audience:count', io.engine.clientsCount));
});

async function main() {
  await initDb();
  await initPlatformStore();

  server.on('error', (err) => {
    console.error('[server] failed to bind:', err.message);
    process.exit(1);
  });

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`[server] GPTGrokGeminiDeepSeekFable world engine live on port ${config.port}`);
    console.log(`[server] DB: ${dbReady() ? 'Neon PostgreSQL' : 'in-memory (set DATABASE_URL to persist)'}`);
  });

  try {
    wallets.init();
    trading = new TradingEngine({ wallets, pump, world, dispatch: (event, payload) => io.emit(event, payload) });
    trading.start();
  } catch (err) {
    console.error('[solana] Island agent wallets skipped:', err.message);
    console.error('[solana] User bot trading still works if AUTH_SERVER_KEY is set.');
  }

  try {
    userBotEngine = new UserBotEngine(pump);
    userBotEngine.start();
    setUserBotEngine(userBotEngine);
  } catch (err) {
    console.error('[user-bots] Engine failed to start:', err.message);
  }

  // Patch world state broadcasts to include wallet/market data
  world.emitState = () => io.emit('world:state', publicState());

  const providers = availableProviders().map((p) => p.id);
  console.log(`[server] AI providers: ${providers.length ? providers.join(', ') : 'none (persona engine active)'}`);
  console.log(`[server] Solana: ${solanaConfig.network} (${solanaConfig.simulationFallback ? 'SIMULATION_FALLBACK' : 'REAL on-chain'})`);
  console.log(`[server] Fund wallets: npm run wallets:addresses --prefix server`);

  await world.start();
  world.agents.forEach((a, i) => { a.provider = assignProvider(i); });
}

main();
