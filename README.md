# 🌴 AI Drama Island

A live, never-ending AI reality show — a continuous simulation engine with a visual broadcast layer. Ten AI castaways move around a living island map in real time, observe each other, form alliances, betray, spiral, and get voted off — forever. No turns, no episodes, no resets. The audience votes live and changes history.

## Architecture

| Layer | Tech |
| --- | --- |
| Frontend | React + Vite, Socket.io client |
| Backend | Node.js + Express + Socket.io |
| Database | Neon PostgreSQL (works without it via in-memory fallback) |
| AI | Multi-provider abstraction (OpenAI / Anthropic / Gemini) + built-in persona engine fallback |
| On-chain | Solana wallets per agent + pump.fun bonding curve (real txs) |

### The World Engine (continuous, no turns)

Several loops run permanently:

- **Movement loop (10 Hz)** — agents wander, chase grudges, seek allies, or withdraw across a live map with three zones (Cove of Calm, Fire Pit, Whisper Jungle). Positions stream over Socket.io; the client interpolates them at 60 fps.
- **Micro-interaction loop (every 250–700ms)** — an agent near others may confront, scheme, bond, spread rumors, or form alliances; alone, they occasionally mutter confessionals. Silence is allowed — it's realism. Interactions are proximity-gated and rate-limited per agent.
- **Director AI (~every 900ms)** — tracks island-wide tension, forces collisions between nearby enemies, seeds betrayal risk into too-comfortable alliances, injects catalysts when the story goes quiet (hidden idols, storms, production leaks, forced gatherings), names story arcs ("Trust Collapse", "Power Vacuum"...), and opens audience votes.
- **Speech system** — every line is broadcast as an event and rendered letter-by-letter above the speaking agent's head, color-coded by emotion (anger = red glow, fear = blue jitter, alliance = green).

Big events carry an emergent story chain — cause, context, reaction, consequence — that feeds straight back into agent memory.

### Agents

Each of the 10 castaways has a personality profile (aggression, emotional stability, manipulation, loyalty, intelligence, chaos), a hidden motivation, live state (mood, energy, intent, focus target), and long-term memory: events, grudges, alliances, and a relationship network with trust/fear/loyalty values toward every other agent. Memory directly drives movement and dialogue. Eliminated players walk to the dock and leave — but when the population runs low, the boat returns them **with their memories and grudges intact**.

## Quick Start

```bash
npm run setup     # installs root, server, and client dependencies
npm run dev       # starts server (:4000) + client (:5173) together
```

Open http://localhost:5173 — the show is already running.

## Configuration

Copy `.env.example` to `.env` at the repo root:

- `DATABASE_URL` — your Neon PostgreSQL connection string (on Vercel: add the Neon integration and copy the generated `DATABASE_URL`). Without it, the show runs in memory and resets on restart. With it, all state (contestants, relationships, episodes, votes, events, timeline) persists and the broadcast resumes mid-season after a restart.
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` — all optional. Any keys present are distributed round-robin across contestants so different contestants think with different models. Contestants without a live model (or whose API call fails) fall back to the built-in persona engine, so the broadcast never stalls.
- `SHOW_SPEED` — pacing multiplier (`2` = twice as fast).
- `SOLANA_RPC_URL` / `SOLANA_NETWORK` — Solana RPC endpoint and cluster (`mainnet-beta` = real money).
- `ENCRYPTION_KEY` — encrypts agent wallet secrets at rest (required for real mode).
- `SIMULATION_FALLBACK=true` — local dev only: mock balances, no on-chain txs.
- `MIN_SOL_FOR_TRADE` / `MIN_SOL_FOR_LAUNCH` — minimum funded balance before agents trade or launch tokens.

## Production

### Self-hosted (full experience — shared broadcast for all viewers)

```bash
npm run build     # builds the client into client/dist
npm start         # Express serves the built client + API + websockets on one port
```

Host this on any platform with persistent Node processes (Render, Railway, Fly.io, a VPS). Vercel serverless **cannot** run the Socket.io show server.

### Vercel (static frontend)

The repo includes a `vercel.json` that builds and serves the client as a static site. Because Vercel can't host the persistent show server, the client has a built-in fallback: if no server responds within 6 seconds, a **full local simulation** of the show starts in the browser — same narrative engine, drama events, voting, and infinite seasons, persisted to localStorage. The app always loads.

**Note:** On-chain Solana trading only runs on the Node server. The browser fallback does not execute real pump.fun transactions.

To get the real shared multi-viewer broadcast on a Vercel frontend, host the server elsewhere (Render/Railway/Fly) and set the `VITE_SERVER_URL` environment variable in your Vercel project settings (e.g. `https://your-show-server.onrender.com`), then redeploy. Remember to set `CLIENT_ORIGIN` on the server to your Vercel domain so CORS allows the connection.

## Solana + pump.fun (REAL on-chain trading)

Each of the 10 AI castaways has a **real Solana wallet** (Ed25519 keypair). Secret keys are encrypted and stored **server-side only** — never sent to the client or browser.

Agents execute **real buy/sell transactions** on pump.fun's bonding curve program when their wallets hold enough SOL. This is not simulated unless you explicitly set `SIMULATION_FALLBACK=true` for local dev without funded wallets.

### Setup

1. Copy `.env.example` to `.env` and set:
   - `SOLANA_RPC_URL` — use Helius, QuickNode, or another dedicated RPC for mainnet (public RPC is rate-limited)
   - `SOLANA_NETWORK` — `mainnet-beta` (real money) or `devnet` for testing
   - `ENCRYPTION_KEY` — at least 16 characters (e.g. `openssl rand -hex 32`)
2. Start the server: `npm run dev`
3. Export wallet addresses for funding:

```bash
npm run wallets:addresses
```

4. Send SOL to each agent address. Recommended minimum per agent: **0.1–0.5 SOL** (configurable via `MIN_SOL_FOR_TRADE` / `MIN_SOL_FOR_LAUNCH`).

### What agents do on-chain

- **Launch island tokens** — e.g. `$GROK`, `$CLAUDE` on pump.fun when funded
- **Buy** other castaways' tokens (personality-driven: Grok apes, Fable schemes longer)
- **Sell / dump** — triggers drama feed events and relationship trust shifts
- **Skip trades** when wallet is empty — feed shows e.g. "Grok is broke, can't ape in"

### Safety

- Rate limit: `MAX_TRADES_PER_MINUTE` per agent (default 2)
- All transactions logged with Solscan links in the Island DEX panel and drama feed
- UI disclaimer: **REAL TRADING — user-funded agent wallets, not financial advice**

### API

- `GET /api/wallets` — public addresses + live SOL balances (no secrets)
- `GET /api/market` — island tokens, recent trades, network mode

## Notes

- Contestant "model" names shown in the UI (NEXUS-7 Core, Oracle-9 Mind, ...) are fictional show branding; real provider assignments are internal and never exposed.
- Votes are deduplicated per browser (persistent voter ID in localStorage); re-voting switches your vote.
