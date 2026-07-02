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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.clientOrigin, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const world = new WorldEngine({
  speed: config.speed,
  dispatch: (event, payload) => {
    io.emit(event, payload);
    if (event === 'feed:item' && payload.kind !== 'system') {
      insertEvent(1, world.arcNumber, payload.kind, payload);
    }
  },
  // LLM line generation with a pace guarantee: if the provider takes more
  // than 3s, the persona engine answers instead so the world keeps moving.
  gen: async (agent, intent, ctx, w) => {
    if (!agent.provider || agent.provider === 'persona') return personaLine(intent, agent, ctx);
    const line = await Promise.race([speak(agent, w, intent, ctx), sleep(3000).then(() => null)]);
    return line ?? personaLine(intent, agent, ctx);
  },
  save: (snapshot) => saveSnapshot(snapshot),
  restore: async () => await loadSnapshot(),
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    db: dbReady() ? 'neon' : 'memory',
    aiProviders: availableProviders().map((p) => p.id),
    arc: world.arc,
    tension: Math.round(world.tension),
    population: world.activeAgents().length,
    voting: !!world.voting,
  });
});

app.get('/api/state', (req, res) => {
  res.json(world.serialize());
});

// Serve the built client in production (single-deploy setup)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

io.on('connection', (socket) => {
  socket.emit('world:state', world.serialize());
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
  // assign real AI providers round-robin across the cast (fictional labels stay on screen)
  server.listen(config.port, () => {
    console.log(`[server] AI Drama Island world engine live on http://localhost:${config.port}`);
    console.log(`[server] DB: ${dbReady() ? 'Neon PostgreSQL' : 'in-memory (set DATABASE_URL to persist)'}`);
    const providers = availableProviders().map((p) => p.id);
    console.log(`[server] AI providers: ${providers.length ? providers.join(', ') : 'none (persona engine active)'}`);
  });
  await world.start();
  world.agents.forEach((a, i) => { a.provider = assignProvider(i); });
}

main();
