import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { Server } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initDb, dbReady, saveSnapshot, loadSnapshot, insertEvent, insertVote } from './db.js';
import { WorldEngine } from './engine/world.js';
import { speak } from './ai/brain.js';
import { personaLine } from './ai/persona.js';
import { availableProviders, assignProvider } from './ai/providers.js';
import { PumpService } from './solana/pump.js';
import { WalletManager } from './solana/wallets.js';
import { TradingEngine } from './solana/trading.js';
import { solanaConfig } from './solana/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.clientOrigin, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pump = new PumpService(solanaConfig.rpcUrl);
const wallets = new WalletManager({ connection: pump.connection });

let trading = null;

const world = new WorldEngine({
  speed: config.speed,
  dispatch: (event, payload) => {
    io.emit(event, payload);
    if (event === 'feed:item' && payload.kind !== 'system') {
      insertEvent(1, world.arcNumber, payload.kind, payload);
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
  const market = trading?.getMarketState() ?? {
    mode: solanaConfig.simulationFallback ? 'simulation_fallback' : 'real',
    network: solanaConfig.network,
    disclaimer: 'REAL TRADING — user-funded agent wallets. Not financial advice.',
    recentTrades: [],
    islandTokens: {},
    wallets: wallets.allPublicWallets(),
  };
  return {
    ...base,
    market,
    agents: base.agents.map((a) => trading ? trading.enrichAgent(a) : { ...a, wallet: wallets.getPublicWallet(a.id) }),
  };
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    db: dbReady() ? 'neon' : 'memory',
    aiProviders: availableProviders().map((p) => p.id),
    arc: world.arc,
    tension: Math.round(world.tension),
    population: world.activeAgents().length,
    voting: !!world.voting,
    solana: {
      network: solanaConfig.network,
      mode: solanaConfig.simulationFallback ? 'simulation_fallback' : 'real',
      rpc: solanaConfig.rpcUrl,
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
  res.json(trading?.getMarketState() ?? { recentTrades: [], islandTokens: {} });
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

  try {
    wallets.init();
    trading = new TradingEngine({ wallets, pump, world, dispatch: (event, payload) => io.emit(event, payload) });
    trading.start();
  } catch (err) {
    console.error('[solana] Wallet init failed:', err.message);
    console.error('[solana] Set ENCRYPTION_KEY in .env or SIMULATION_FALLBACK=true for local dev without wallets.');
    process.exit(1);
  }

  // Patch world state broadcasts to include wallet/market data
  world.emitState = () => io.emit('world:state', publicState());

  server.listen(config.port, () => {
    console.log(`[server] AI Drama Island world engine live on http://localhost:${config.port}`);
    console.log(`[server] DB: ${dbReady() ? 'Neon PostgreSQL' : 'in-memory (set DATABASE_URL to persist)'}`);
    const providers = availableProviders().map((p) => p.id);
    console.log(`[server] AI providers: ${providers.length ? providers.join(', ') : 'none (persona engine active)'}`);
    console.log(`[server] Solana: ${solanaConfig.network} (${solanaConfig.simulationFallback ? 'SIMULATION_FALLBACK' : 'REAL on-chain'})`);
    console.log(`[server] Fund wallets: npm run wallets:addresses --prefix server`);
  });
  await world.start();
  world.agents.forEach((a, i) => { a.provider = assignProvider(i); });
}

main();
