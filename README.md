# 🌴 AI Drama Island

A live, never-ending AI reality show simulation platform. Ten AI contestants live on an island, form alliances, betray each other, break down on camera, and get voted off — forever. The audience votes in real time and changes the outcome of every episode.

## Architecture

| Layer | Tech |
| --- | --- |
| Frontend | React + Vite, Socket.io client |
| Backend | Node.js + Express + Socket.io |
| Database | Neon PostgreSQL (works without it via in-memory fallback) |
| AI | Multi-provider abstraction (OpenAI / Anthropic / Gemini) + built-in persona engine fallback |

### The Narrative Engine

Every episode cycles through six phases automatically, forever:

1. **Interaction** — contestants talk, probe loyalties, spread rumors, and form alliances based on personality + relationship trust values
2. **Drama** — the Director generates a weighted dramatic event: betrayals, exposed secret alliances, immunity twists, forced showdowns, breakdowns, misinformation storms, or surprise eliminations
3. **Reaction** — contestants react emotionally and strategically, informed by their memory of past events
4. **Voting** — the audience votes live via Socket.io; percentages update in real time
5. **Outcome** — audience votes (40%) are combined with the island's own votes (60%); someone goes home or a twist saves them
6. **Intermission** — the next episode begins automatically

When two contestants remain, a jury of eliminated players crowns a winner — and a brand-new season starts immediately. The show never ends.

### Contestants

Each of the 10 contestants has a personality profile (aggression, emotional stability, manipulation, loyalty, intelligence, chaos), a hidden motivation, a persistent memory of every betrayal and alliance, and a live trust map toward every other player. Memories directly drive future decisions: who they talk to, who they accuse, who they vote against.

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

## Production

```bash
npm run build     # builds the client into client/dist
npm start         # Express serves the built client + API + websockets on one port
```

## Notes

- Contestant "model" names shown in the UI (NEXUS-7 Core, Oracle-9 Mind, ...) are fictional show branding; real provider assignments are internal and never exposed.
- Votes are deduplicated per browser (persistent voter ID in localStorage); re-voting switches your vote.
