import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { Server } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initDb, dbReady } from './db.js';
import { Director } from './engine/narrative.js';
import { serialize } from './engine/state.js';
import { availableProviders } from './ai/providers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.clientOrigin, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

const director = new Director(io);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    db: dbReady() ? 'neon' : 'memory',
    aiProviders: availableProviders().map((p) => p.id),
    season: director.game?.season ?? null,
    episode: director.game?.episode ?? null,
    phase: director.game?.phase ?? null,
  });
});

app.get('/api/state', (req, res) => {
  if (!director.game) return res.status(503).json({ error: 'Show is booting...' });
  res.json(serialize(director.game));
});

// Serve the built client in production (single-deploy setup)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

io.on('connection', (socket) => {
  if (director.game) {
    socket.emit('game:state', serialize(director.game));
    if (director.game.voting && director.game.phase === 'voting') {
      socket.emit('vote:open', director.publicVoting());
    }
  }
  io.emit('audience:count', io.engine.clientsCount);

  socket.on('vote:cast', ({ voterId, contestantId }, ack) => {
    if (typeof voterId !== 'string' || typeof contestantId !== 'string') {
      return ack?.({ ok: false, error: 'Invalid vote payload.' });
    }
    const result = director.castAudienceVote(voterId.slice(0, 64), contestantId);
    ack?.(result);
  });

  socket.on('disconnect', () => io.emit('audience:count', io.engine.clientsCount));
});

async function main() {
  await initDb();
  server.listen(config.port, () => {
    console.log(`[server] AI Drama Island broadcasting on http://localhost:${config.port}`);
    console.log(`[server] DB: ${dbReady() ? 'Neon PostgreSQL' : 'in-memory (set DATABASE_URL to persist)'}`);
    const providers = availableProviders().map((p) => p.id);
    console.log(`[server] AI providers: ${providers.length ? providers.join(', ') : 'none (persona engine active)'}`);
  });
  director.start();
}

main();
