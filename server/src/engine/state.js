import { CAST_POOL } from './cast.js';
import { assignProvider } from '../ai/providers.js';

const clamp01 = (v) => Math.max(0.02, Math.min(0.98, v));

export function createContestant(template, index) {
  return {
    id: template.name.toLowerCase(),
    name: template.name,
    modelLabel: template.modelLabel,
    avatar: template.avatar,
    color: template.color,
    tagline: template.tagline,
    speechStyle: template.speechStyle,
    personality: { ...template.personality },
    hiddenMotivation: template.hiddenMotivation,
    provider: assignProvider(index),
    mood: 'neutral',
    status: 'safe', // safe | at_risk | immune | eliminated
    eliminated: false,
    placement: null,
    memory: [],
    relationships: {},
    stats: { votesReceived: 0, betrayals: 0, alliancesFormed: 0, dramaScore: 0 },
  };
}

export function createSeason(seasonNumber) {
  const contestants = CAST_POOL.map((t, i) => createContestant(t, i));
  // Seed pairwise relationships with mild random bias so day one already has texture
  for (const a of contestants) {
    for (const b of contestants) {
      if (a.id === b.id) continue;
      a.relationships[b.id] = clamp01(0.5 + (Math.random() - 0.5) * 0.3);
    }
  }
  return {
    season: seasonNumber,
    episode: 1,
    phase: 'intermission',
    phaseEndsAt: Date.now(),
    contestants,
    alliances: [],
    feed: [],
    timeline: [],
    voting: null,
    lastDrama: null,
    winnerHistory: [],
    startedAt: Date.now(),
  };
}

export function adjustTrust(game, fromId, toId, delta) {
  const from = game.contestants.find((c) => c.id === fromId);
  if (!from || fromId === toId) return;
  from.relationships[toId] = clamp01((from.relationships[toId] ?? 0.5) + delta);
}

export function remember(contestant, text, valence = 0, weight = 1) {
  contestant.memory.push({ text, valence, weight, ts: Date.now() });
  if (contestant.memory.length > 40) {
    // Keep the heaviest memories; trim trivial ones first
    contestant.memory.sort((a, b) => a.weight - b.weight || a.ts - b.ts);
    contestant.memory.splice(0, contestant.memory.length - 40);
    contestant.memory.sort((a, b) => a.ts - b.ts);
  }
  updateMood(contestant);
}

export function updateMood(c) {
  const recent = c.memory.slice(-6);
  const score = recent.reduce((s, m) => s + m.valence * m.weight, 0);
  const p = c.personality;
  if (c.eliminated) { c.mood = 'gone'; return; }
  if (score <= -3 && p.emotionalStability < 0.4) c.mood = 'devastated';
  else if (score <= -2) c.mood = 'angry';
  else if (score <= -0.5) c.mood = 'anxious';
  else if (score >= 2.5 && p.manipulation > 0.7) c.mood = 'scheming';
  else if (score >= 2) c.mood = 'confident';
  else if (score >= 0.5) c.mood = 'happy';
  else c.mood = 'neutral';
}

export function alive(game) {
  return game.contestants.filter((c) => !c.eliminated);
}

export function serialize(game) {
  return {
    season: game.season,
    episode: game.episode,
    phase: game.phase,
    phaseEndsAt: game.phaseEndsAt,
    contestants: game.contestants.map((c) => ({
      id: c.id,
      name: c.name,
      modelLabel: c.modelLabel,
      avatar: c.avatar,
      color: c.color,
      tagline: c.tagline,
      mood: c.mood,
      status: c.status,
      eliminated: c.eliminated,
      placement: c.placement,
      relationships: c.relationships,
      alliances: game.alliances.filter((a) => !a.dissolved && a.members.includes(c.id)).map((a) => a.id),
      stats: c.stats,
    })),
    alliances: game.alliances,
    feed: game.feed.slice(-120),
    timeline: game.timeline.slice(-100),
    voting: game.voting
      ? { ...game.voting, voters: undefined, totalVotes: game.voting.totalVotes }
      : null,
    winnerHistory: game.winnerHistory,
  };
}
