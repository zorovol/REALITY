import { CAST_POOL } from './cast.js';
import { personaLine } from './persona.js';

/**
 * LocalShow — a full client-side port of the server's narrative engine.
 * Used as a safe fallback when no show server is reachable (e.g. static
 * hosting on Vercel): the broadcast runs entirely in the browser, emitting
 * the exact same events the server would, so the UI works unchanged.
 * State persists to localStorage so the story survives reloads.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const clamp01 = (v) => Math.max(0.02, Math.min(0.98, v));
let idCounter = 0;
const nextId = () => `sim-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

const DUR = {
  interaction: 40_000,
  drama: 14_000,
  reaction: 26_000,
  voting: 35_000,
  outcome: 16_000,
  intermission: 8_000,
};

const STORE_KEY = 'adi-local-show-v1';

function createContestant(template) {
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
    mood: 'neutral',
    status: 'safe',
    eliminated: false,
    placement: null,
    memory: [],
    relationships: {},
    stats: { votesReceived: 0, betrayals: 0, alliancesFormed: 0, dramaScore: 0 },
  };
}

function createSeason(seasonNumber) {
  const contestants = CAST_POOL.map((t) => createContestant(t));
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
    forcedPair: null,
    winnerHistory: [],
  };
}

export class LocalShow {
  constructor(dispatch) {
    this.dispatch = dispatch;
    this.stopped = false;
    this.game = null;
  }

  stop() {
    this.stopped = true;
  }

  // ── persistence (localStorage) ────────────────────────────────────────────

  save() {
    try {
      const g = this.game;
      localStorage.setItem(STORE_KEY, JSON.stringify({
        season: g.season, episode: g.episode,
        contestants: g.contestants, alliances: g.alliances,
        timeline: g.timeline.slice(-100), feed: g.feed.slice(-120),
        winnerHistory: g.winnerHistory,
      }));
    } catch { /* storage full or unavailable — the show goes on */ }
  }

  restore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return false;
      const snap = JSON.parse(raw);
      if (!snap?.contestants?.length) return false;
      if (snap.contestants.filter((c) => !c.eliminated).length <= 2) return false;
      const game = createSeason(snap.season);
      game.episode = snap.episode;
      game.contestants = snap.contestants;
      game.alliances = snap.alliances ?? [];
      game.timeline = snap.timeline ?? [];
      game.feed = snap.feed ?? [];
      game.winnerHistory = snap.winnerHistory ?? [];
      this.game = game;
      return true;
    } catch {
      return false;
    }
  }

  // ── event emission (mirrors the server's socket protocol) ───────────────

  emitFeed(item) {
    const entry = { id: nextId(), ts: Date.now(), ...item };
    this.game.feed.push(entry);
    if (this.game.feed.length > 300) this.game.feed.splice(0, this.game.feed.length - 300);
    this.dispatch('feed:item', entry);
    return entry;
  }

  emitTimeline(type, label, icon, detail = '') {
    const entry = {
      id: nextId(), ts: Date.now(),
      season: this.game.season, episode: this.game.episode,
      type, label, icon, detail,
    };
    this.game.timeline.push(entry);
    if (this.game.timeline.length > 200) this.game.timeline.splice(0, this.game.timeline.length - 200);
    this.dispatch('timeline:item', entry);
  }

  emitState() {
    this.dispatch('game:state', this.serialize());
  }

  serialize() {
    const g = this.game;
    return {
      season: g.season,
      episode: g.episode,
      phase: g.phase,
      phaseEndsAt: g.phaseEndsAt,
      contestants: g.contestants.map((c) => ({
        id: c.id, name: c.name, modelLabel: c.modelLabel, avatar: c.avatar,
        color: c.color, tagline: c.tagline, mood: c.mood, status: c.status,
        eliminated: c.eliminated, placement: c.placement,
        relationships: c.relationships,
        alliances: g.alliances.filter((a) => !a.dissolved && a.members.includes(c.id)).map((a) => a.id),
        stats: c.stats,
      })),
      alliances: g.alliances,
      feed: g.feed.slice(-120),
      timeline: g.timeline.slice(-100),
      voting: this.publicVoting(),
      winnerHistory: g.winnerHistory,
    };
  }

  setPhase(phase, durationMs) {
    this.game.phase = phase;
    this.game.phaseEndsAt = Date.now() + durationMs;
    this.dispatch('phase:change', {
      phase, endsAt: this.game.phaseEndsAt,
      episode: this.game.episode, season: this.game.season,
    });
    this.save();
  }

  // ── shared helpers ────────────────────────────────────────────────────────

  alive() {
    return this.game.contestants.filter((c) => !c.eliminated);
  }

  cast(id) {
    return this.game.contestants.find((c) => c.id === id);
  }

  adjustTrust(fromId, toId, delta) {
    const from = this.cast(fromId);
    if (!from || fromId === toId) return;
    from.relationships[toId] = clamp01((from.relationships[toId] ?? 0.5) + delta);
  }

  remember(c, text, valence = 0, weight = 1) {
    c.memory.push({ text, valence, weight, ts: Date.now() });
    if (c.memory.length > 40) {
      c.memory.sort((a, b) => a.weight - b.weight || a.ts - b.ts);
      c.memory.splice(0, c.memory.length - 40);
      c.memory.sort((a, b) => a.ts - b.ts);
    }
    this.updateMood(c);
  }

  updateMood(c) {
    if (c.eliminated) { c.mood = 'gone'; return; }
    const score = c.memory.slice(-6).reduce((s, m) => s + m.valence * m.weight, 0);
    const p = c.personality;
    if (score <= -3 && p.emotionalStability < 0.4) c.mood = 'devastated';
    else if (score <= -2) c.mood = 'angry';
    else if (score <= -0.5) c.mood = 'anxious';
    else if (score >= 2.5 && p.manipulation > 0.7) c.mood = 'scheming';
    else if (score >= 2) c.mood = 'confident';
    else if (score >= 0.5) c.mood = 'happy';
    else c.mood = 'neutral';
  }

  recentMemoryText(c) {
    const heavy = [...c.memory].sort((a, b) => b.weight - a.weight)[0];
    return heavy?.text ?? 'everything that happened here';
  }

  activeAlliances() {
    return this.game.alliances.filter((a) => !a.dissolved);
  }

  allianceBetween(aId, bId) {
    return this.activeAlliances().find((al) => al.members.includes(aId) && al.members.includes(bId));
  }

  pickPartner(c, pool) {
    const others = pool.filter((o) => o.id !== c.id);
    if (others.length === 0) return null;
    const weights = others.map((o) => 0.3 + Math.abs((c.relationships[o.id] ?? 0.5) - 0.5) * 2);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < others.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return others[i];
    }
    return others[others.length - 1];
  }

  say(c, intent, ctx = {}, kind = 'dialogue') {
    const text = personaLine(intent, c, ctx);
    return this.emitFeed({
      kind, intent,
      speakerId: c.id, speakerName: c.name,
      avatar: c.avatar, color: c.color,
      text, targetName: ctx.target ?? null,
    });
  }

  // ── phase 1: interaction ─────────────────────────────────────────────────

  async interactionPhase() {
    const duration = DUR.interaction;
    this.setPhase('interaction', duration);
    this.emitFeed({ kind: 'system', text: `Episode ${this.game.episode} — Day breaks over the island. Cameras rolling.` });

    const pool = this.alive();
    const beats = Math.min(8, 3 + Math.floor(pool.length / 2));
    const beatGap = Math.max(1500, Math.floor((duration - 4000) / beats));

    for (let i = 0; i < beats && !this.stopped; i++) {
      const speaker = pick(pool.filter((c) => !c.eliminated));
      const partner = this.pickPartner(speaker, pool);
      if (!partner) break;
      const trust = speaker.relationships[partner.id] ?? 0.5;
      const p = speaker.personality;

      if (trust > 0.62 && !this.allianceBetween(speaker.id, partner.id) && chance(0.25 + p.manipulation * 0.3)) {
        await this.allianceBeat(speaker, partner);
      } else if (trust < 0.35 && chance(0.3 + p.aggression * 0.4)) {
        this.say(speaker, 'accusation', { target: partner.name, other: pick(pool.filter((x) => x.id !== speaker.id && x.id !== partner.id))?.name, memory: this.recentMemoryText(speaker) });
        await sleep(Math.min(2500, beatGap / 2));
        this.say(partner, 'defend', { target: speaker.name });
        this.adjustTrust(partner.id, speaker.id, -0.08);
        this.remember(partner, `${speaker.name} accused me publicly`, -1, 2);
        this.remember(speaker, `I confronted ${partner.name}`, 0.5, 1);
        speaker.stats.dramaScore += 2;
      } else if (p.chaos > 0.7 && chance(0.35)) {
        const victim = pick(pool.filter((x) => x.id !== speaker.id && x.id !== partner.id));
        if (victim) {
          this.say(speaker, 'rumor', { target: partner.name, other: victim.name });
          this.adjustTrust(partner.id, victim.id, -0.1);
          this.remember(partner, `${speaker.name} told me a rumor about ${victim.name}`, -0.5, 1);
        }
      } else if (chance(0.3)) {
        this.say(speaker, 'confessional', { target: partner.name, other: pick(pool)?.name, memory: this.recentMemoryText(speaker) }, 'confessional');
      } else if (chance(0.4)) {
        this.say(speaker, 'probe', { target: partner.name, other: pick(pool)?.name });
      } else {
        this.say(speaker, 'smalltalk', { target: partner.name, other: pick(pool)?.name });
      }
      this.emitState();
      await sleep(beatGap);
    }
  }

  async allianceBeat(a, b) {
    this.say(a, 'alliance_offer', { target: b.name });
    await sleep(2000);
    const acceptChance = (b.relationships[a.id] ?? 0.5) * 0.7 + b.personality.loyalty * 0.2 + 0.1;
    if (chance(acceptChance)) {
      this.say(b, 'alliance_accept', { target: a.name });
      const alliance = {
        id: nextId(),
        name: `${a.name} × ${b.name} Pact`,
        members: [a.id, b.id],
        secret: chance(0.6),
        formedEpisode: this.game.episode,
        dissolved: false,
      };
      this.game.alliances.push(alliance);
      a.stats.alliancesFormed++; b.stats.alliancesFormed++;
      this.adjustTrust(a.id, b.id, 0.15);
      this.adjustTrust(b.id, a.id, 0.15);
      this.remember(a, `Formed an alliance with ${b.name}`, 1, 2);
      this.remember(b, `Formed an alliance with ${a.name}`, 1, 2);
      this.emitFeed({ kind: 'announcement', tone: 'alliance', text: `🤝 ALLIANCE FORMED — ${a.name} and ${b.name} have made a ${alliance.secret ? 'SECRET ' : ''}pact.` });
      this.emitTimeline('alliance', `${a.name} + ${b.name} alliance`, '🤝', alliance.secret ? 'Formed in secret' : 'Formed openly');
    } else {
      this.say(b, 'alliance_reject', { target: a.name, memory: this.recentMemoryText(b) });
      this.adjustTrust(a.id, b.id, -0.12);
      this.remember(a, `${b.name} rejected my alliance offer`, -1, 2);
      this.remember(b, `I rejected ${a.name}'s alliance offer`, 0, 1);
    }
  }

  // ── phase 2: drama ────────────────────────────────────────────────────────

  async dramaPhase() {
    this.setPhase('drama', DUR.drama);
    const pool = this.alive();

    const options = [
      { type: 'betrayal', weight: this.activeAlliances().length > 0 ? 3 : 0 },
      { type: 'alliance_exposed', weight: this.activeAlliances().filter((a) => a.secret).length > 0 ? 2.5 : 0 },
      { type: 'immunity_twist', weight: 1.5 },
      { type: 'forced_vote', weight: 1.2 },
      { type: 'breakdown', weight: pool.some((c) => c.personality.emotionalStability < 0.4) ? 1.5 : 0.5 },
      { type: 'rumor_storm', weight: 1.5 },
      { type: 'surprise_elimination', weight: pool.length > 5 ? 0.6 : 0 },
    ].filter((o) => o.weight > 0);

    const total = options.reduce((s, o) => s + o.weight, 0);
    let roll = Math.random() * total;
    let dramaType = options[0].type;
    for (const o of options) { roll -= o.weight; if (roll <= 0) { dramaType = o.type; break; } }

    this.game.lastDrama = dramaType;
    await this[`drama_${dramaType}`](pool);
    this.emitState();
    this.save();
    await sleep(Math.max(1000, this.game.phaseEndsAt - Date.now()));
  }

  async drama_betrayal(pool) {
    const alliances = this.activeAlliances().filter((a) => a.members.every((id) => !this.cast(id).eliminated));
    if (alliances.length === 0) return this.drama_rumor_storm(pool);
    const alliance = pick(alliances);
    const members = alliance.members.map((id) => this.cast(id));
    members.sort((a, b) => a.personality.loyalty - b.personality.loyalty);
    const traitor = members[0];
    const victim = pick(members.filter((m) => m.id !== traitor.id));
    alliance.dissolved = true;
    traitor.stats.betrayals++;
    traitor.stats.dramaScore += 5;

    this.emitFeed({ kind: 'drama', tone: 'betrayal', big: true, text: `💥 BETRAYAL DETECTED — ${traitor.name} has turned on ${victim.name}! The "${alliance.name}" is DEAD.` });
    await sleep(1800);
    this.say(traitor, 'betrayal_gloat', { target: victim.name });
    await sleep(1800);
    this.say(victim, 'betrayal_pain', { target: traitor.name, memory: this.recentMemoryText(victim) });

    this.adjustTrust(victim.id, traitor.id, -0.45);
    for (const w of pool) if (w.id !== traitor.id) this.adjustTrust(w.id, traitor.id, -0.12);
    this.remember(traitor, `I betrayed ${victim.name} and broke our alliance`, 0.5, 3);
    this.remember(victim, `${traitor.name} BETRAYED me — never forget`, -2, 3);
    for (const w of pool) if (w.id !== traitor.id && w.id !== victim.id) this.remember(w, `${traitor.name} betrayed ${victim.name}`, -0.5, 2);
    this.emitTimeline('betrayal', `${traitor.name} betrayed ${victim.name}`, '🗡️', `The ${alliance.name} collapsed`);
    victim.status = 'at_risk';
  }

  async drama_alliance_exposed(pool) {
    const secret = this.activeAlliances().filter((a) => a.secret);
    if (secret.length === 0) return this.drama_rumor_storm(pool);
    const alliance = pick(secret);
    alliance.secret = false;
    const [a, b] = alliance.members.map((id) => this.cast(id));
    const exposer = pick(pool.filter((c) => !alliance.members.includes(c.id))) ?? a;
    this.emitFeed({ kind: 'drama', tone: 'exposed', big: true, text: `🚨 SECRET EXPOSED — ${exposer.name} just revealed the hidden pact between ${a.name} and ${b.name} to the whole island!` });
    await sleep(1800);
    this.say(exposer, 'accusation', { target: a.name, other: b.name });
    for (const w of pool) {
      if (!alliance.members.includes(w.id)) {
        this.adjustTrust(w.id, a.id, -0.15);
        this.adjustTrust(w.id, b.id, -0.15);
        this.remember(w, `${a.name} and ${b.name} had a secret alliance`, -1, 2);
      }
    }
    this.remember(a, `Our secret alliance with ${b.name} was exposed by ${exposer.name}`, -1.5, 3);
    this.remember(b, `Our secret alliance with ${a.name} was exposed by ${exposer.name}`, -1.5, 3);
    exposer.stats.dramaScore += 4;
    this.emitTimeline('exposed', `Secret pact exposed`, '🚨', `${a.name} + ${b.name}, outed by ${exposer.name}`);
    a.status = 'at_risk'; b.status = 'at_risk';
  }

  async drama_immunity_twist(pool) {
    const winner = pick(pool);
    for (const c of pool) if (c.status === 'immune') c.status = 'safe';
    winner.status = 'immune';
    this.emitFeed({ kind: 'drama', tone: 'twist', big: true, text: `🛡️ IMMUNITY TWIST — ${winner.name} has won surprise immunity and CANNOT be eliminated this episode!` });
    await sleep(1500);
    this.say(winner, 'immunity_win', {});
    this.remember(winner, `I won immunity in episode ${this.game.episode}`, 2, 2);
    for (const c of pool) if (c.id !== winner.id) this.remember(c, `${winner.name} won immunity`, -0.3, 1);
    this.emitTimeline('twist', `${winner.name} wins immunity`, '🛡️', 'Untouchable this episode');
  }

  async drama_forced_vote(pool) {
    const [a, b] = [...pool].sort((x, y) => y.stats.dramaScore - x.stats.dramaScore).slice(0, 2);
    this.emitFeed({ kind: 'drama', tone: 'twist', big: true, text: `⚔️ FORCED SHOWDOWN — Production has locked tonight's vote to a head-to-head: ${a.name} vs ${b.name}. One of them is going home... unless the audience saves them.` });
    a.status = 'at_risk'; b.status = 'at_risk';
    this.game.forcedPair = [a.id, b.id];
    await sleep(1500);
    this.say(a, 'twist_react', { event: `a forced showdown against ${b.name}` });
    this.say(b, 'twist_react', { event: `a forced showdown against ${a.name}` });
    this.remember(a, `Forced into a showdown against ${b.name}`, -1.5, 2);
    this.remember(b, `Forced into a showdown against ${a.name}`, -1.5, 2);
    this.emitTimeline('twist', `Showdown: ${a.name} vs ${b.name}`, '⚔️', 'Vote locked to two names');
  }

  async drama_breakdown(pool) {
    const fragile = [...pool].sort((a, b) => a.personality.emotionalStability - b.personality.emotionalStability)[0];
    this.emitFeed({ kind: 'drama', tone: 'emotional', big: true, text: `💔 EMOTIONAL BREAKDOWN — ${fragile.name} has hit their limit. The island is watching.` });
    await sleep(1500);
    this.say(fragile, 'breakdown', {});
    this.remember(fragile, `I broke down in front of everyone`, -2, 2);
    const comforter = [...pool].filter((c) => c.id !== fragile.id).sort((a, b) => b.personality.loyalty - a.personality.loyalty)[0];
    if (comforter) {
      this.adjustTrust(fragile.id, comforter.id, 0.15);
      this.remember(comforter, `I comforted ${fragile.name} during their breakdown`, 0.5, 1);
      this.emitFeed({ kind: 'system', text: `${comforter.name} pulls ${fragile.name} aside, away from the cameras.` });
    }
    fragile.stats.dramaScore += 3;
    this.emitTimeline('emotional', `${fragile.name} breaks down`, '💔', comforter ? `Comforted by ${comforter.name}` : '');
  }

  async drama_rumor_storm(pool) {
    const source = [...pool].sort((a, b) => b.personality.chaos - a.personality.chaos)[0];
    const victim = pick(pool.filter((c) => c.id !== source.id));
    this.emitFeed({ kind: 'drama', tone: 'rumor', big: true, text: `🐍 MISINFORMATION STORM — A rumor about ${victim.name} is spreading through the island... and it traces back to ${source.name}.` });
    await sleep(1500);
    this.say(source, 'rumor', { target: pick(pool.filter((c) => c.id !== source.id && c.id !== victim.id))?.name ?? victim.name, other: victim.name });
    for (const w of pool) if (w.id !== victim.id && w.id !== source.id && chance(0.6)) {
      this.adjustTrust(w.id, victim.id, -0.1);
      this.remember(w, `Heard a rumor about ${victim.name}`, -0.3, 1);
    }
    this.remember(victim, `A rumor about me spread across the island`, -1.5, 2);
    this.remember(source, `I started a rumor about ${victim.name}`, 0.5, 2);
    source.stats.dramaScore += 3;
    victim.status = 'at_risk';
    this.emitTimeline('rumor', `Rumor targets ${victim.name}`, '🐍', `Started by ${source.name}`);
  }

  async drama_surprise_elimination(pool) {
    const victim = pick(pool.filter((c) => c.status !== 'immune'));
    this.emitFeed({ kind: 'drama', tone: 'elimination', big: true, text: `☠️ SURPRISE ELIMINATION — No vote. No warning. Production has removed ${victim.name} from the island EFFECTIVE IMMEDIATELY.` });
    await sleep(1800);
    this.say(victim, 'eliminated_exit', { target: pick(pool.filter((c) => c.id !== victim.id))?.name });
    this.eliminate(victim, 'surprise twist');
    for (const w of this.alive()) this.remember(w, `${victim.name} was removed by a surprise twist — no one is safe`, -1, 2);
  }

  // ── phase 3: reaction ─────────────────────────────────────────────────────

  async reactionPhase() {
    const duration = DUR.reaction;
    this.setPhase('reaction', duration);
    const pool = this.alive();
    const reactors = [...pool].sort((a, b) => b.stats.dramaScore - a.stats.dramaScore).slice(0, Math.min(4, pool.length));
    const gap = Math.max(1500, Math.floor((duration - 3000) / (reactors.length + 1)));

    for (const c of reactors) {
      if (this.stopped) return;
      const negative = c.memory.slice(-3).some((m) => m.valence < 0);
      const intent = c.personality.manipulation > 0.7 && chance(0.5)
        ? 'scheme'
        : negative ? 'react_negative' : 'react_positive';
      const rival = this.pickPartner(c, pool);
      if (intent === 'scheme' && rival) {
        const target = pick(pool.filter((x) => x.id !== c.id && x.id !== rival.id));
        this.say(c, 'scheme', { target: rival.name, other: target?.name ?? rival.name }, 'confessional');
      } else {
        this.say(c, intent, { event: this.game.lastDrama?.replaceAll('_', ' ') }, chance(0.5) ? 'confessional' : 'dialogue');
      }
      this.emitState();
      await sleep(gap);
    }
  }

  // ── phase 4: voting ───────────────────────────────────────────────────────

  async votingPhase() {
    const duration = DUR.voting;
    const pool = this.alive();
    const mode = this.game.lastDrama === 'forced_vote' ? 'save' : 'eliminate';
    const candidates = this.game.forcedPair
      ? this.game.forcedPair.map((id) => this.cast(id)).filter((c) => !c.eliminated)
      : pool.filter((c) => c.status !== 'immune');

    this.game.voting = {
      episode: this.game.episode,
      mode,
      candidateIds: candidates.map((c) => c.id),
      counts: Object.fromEntries(candidates.map((c) => [c.id, 0])),
      totalVotes: 0,
      endsAt: Date.now() + duration,
      voters: {},
    };
    this.setPhase('voting', duration);
    this.emitFeed({
      kind: 'announcement', tone: 'voting', big: true,
      text: mode === 'save'
        ? `🗳️ AUDIENCE VOTE OPEN — Vote to SAVE a contestant from tonight's showdown. The island decides the rest.`
        : `🗳️ AUDIENCE VOTE OPEN — Vote to ELIMINATE. Your votes are weighed against the island's own.`,
    });
    this.dispatch('vote:open', this.publicVoting());
    this.emitState();
    await sleep(duration);
    this.dispatch('vote:closed', this.publicVoting());
  }

  publicVoting() {
    const v = this.game?.voting;
    if (!v || this.game.phase !== 'voting') return null;
    return { episode: v.episode, mode: v.mode, candidateIds: v.candidateIds, counts: v.counts, totalVotes: v.totalVotes, endsAt: v.endsAt };
  }

  castVote(voterId, contestantId) {
    const v = this.game?.voting;
    if (!v || this.game.phase !== 'voting' || Date.now() > v.endsAt) return { ok: false, error: 'Voting is closed.' };
    if (!v.candidateIds.includes(contestantId)) return { ok: false, error: 'Not a valid candidate.' };
    const prev = v.voters[voterId];
    if (prev === contestantId) return { ok: false, error: 'Already voted for this contestant.' };
    if (prev) v.counts[prev] = Math.max(0, v.counts[prev] - 1);
    else v.totalVotes++;
    v.voters[voterId] = contestantId;
    v.counts[contestantId]++;
    this.dispatch('vote:update', this.publicVoting());
    return { ok: true };
  }

  // ── phase 5: outcome ──────────────────────────────────────────────────────

  async outcomePhase() {
    this.setPhase('outcome', DUR.outcome);
    const v = this.game.voting;
    const pool = this.alive();

    const islandVotes = {};
    for (const c of pool) {
      const candidates = v.candidateIds.filter((id) => id !== c.id).map((id) => this.cast(id)).filter((x) => x && !x.eliminated);
      if (candidates.length === 0) continue;
      candidates.sort((a, b) => (c.relationships[a.id] ?? 0.5) - (c.relationships[b.id] ?? 0.5));
      const target = candidates[0];
      islandVotes[target.id] = (islandVotes[target.id] ?? 0) + 1;
      target.stats.votesReceived++;
      this.remember(target, `${c.name} voted against me in episode ${this.game.episode}`, -1, 2);
      this.adjustTrust(target.id, c.id, -0.1);
    }

    for (const c of pool.slice(0, 2)) {
      const targetId = Object.keys(islandVotes).find((id) => id !== c.id) ?? v.candidateIds[0];
      const target = this.cast(targetId);
      if (target) this.say(c, 'vote_reasoning', { target: target.name, memory: this.recentMemoryText(c) });
      await sleep(1500);
    }

    const audienceTotal = Math.max(1, v.totalVotes);
    const islandTotal = Math.max(1, Object.values(islandVotes).reduce((a, b) => a + b, 0));
    const scores = {};
    for (const id of v.candidateIds) {
      const audienceShare = (v.counts[id] ?? 0) / audienceTotal;
      const islandShare = (islandVotes[id] ?? 0) / islandTotal;
      scores[id] = v.mode === 'save'
        ? islandShare - audienceShare * 0.8
        : islandShare * 0.6 + audienceShare * 0.4;
    }

    const ranked = v.candidateIds
      .map((id) => this.cast(id))
      .filter((c) => c && !c.eliminated && c.status !== 'immune')
      .sort((a, b) => scores[b.id] - scores[a.id]);

    const doomed = ranked[0];
    if (doomed) {
      const saved = v.mode === 'save' ? ranked[ranked.length - 1] : null;
      if (saved && saved.id !== doomed.id) {
        this.emitFeed({ kind: 'announcement', tone: 'saved', big: true, text: `💙 THE AUDIENCE HAS SPOKEN — ${saved.name} is SAVED by the viewers at home!` });
        this.remember(saved, `The audience saved me in episode ${this.game.episode}`, 2, 3);
        this.emitTimeline('saved', `${saved.name} saved by audience`, '💙', '');
        await sleep(2000);
      }
      this.say(doomed, 'eliminated_exit', { target: pick(pool.filter((c) => c.id !== doomed.id))?.name });
      this.eliminate(doomed, v.mode === 'save' ? 'lost the showdown' : 'voted out');
    }

    this.game.voting = null;
    this.game.forcedPair = null;
    for (const c of this.alive()) {
      if (c.status === 'at_risk') c.status = 'safe';
      this.updateMood(c);
    }
    this.emitState();
    this.save();
    await sleep(Math.max(0, this.game.phaseEndsAt - Date.now()));
  }

  eliminate(contestant, reason) {
    contestant.eliminated = true;
    contestant.status = 'eliminated';
    contestant.mood = 'gone';
    contestant.placement = this.alive().length + 1;
    for (const al of this.activeAlliances()) {
      if (al.members.includes(contestant.id)) al.dissolved = true;
    }
    this.dispatch('contestant:eliminated', { id: contestant.id, name: contestant.name, reason });
    this.emitFeed({ kind: 'drama', tone: 'elimination', big: true, text: `🏝️ ELIMINATED — ${contestant.name} (${reason}). The torch is out. ${this.alive().length} remain.` });
    this.emitTimeline('elimination', `${contestant.name} eliminated`, '🏝️', reason);
    for (const w of this.alive()) this.remember(w, `${contestant.name} was eliminated (${reason})`, w.relationships[contestant.id] > 0.6 ? -1.5 : 0.5, 2);
    this.emitState();
  }

  // ── finale + season rebirth ───────────────────────────────────────────────

  async finale() {
    const finalists = this.alive();
    this.setPhase('outcome', DUR.outcome * 2);
    this.emitFeed({ kind: 'drama', tone: 'finale', big: true, text: `👑 SEASON ${this.game.season} FINALE — ${finalists.map((f) => f.name).join(' vs ')}. The island crowns a champion.` });

    const jury = this.game.contestants.filter((c) => c.eliminated);
    const scores = finalists.map((f) => ({
      f,
      score: jury.reduce((s, j) => s + (j.relationships[f.id] ?? 0.5), 0) + f.stats.dramaScore * 0.05 + Math.random() * 0.5,
    })).sort((a, b) => b.score - a.score);

    const champion = scores[0].f;
    await sleep(3000);
    this.emitFeed({ kind: 'drama', tone: 'finale', big: true, text: `🏆 THE WINNER OF AI DRAMA ISLAND SEASON ${this.game.season} IS... ${champion.name.toUpperCase()}! ${champion.avatar}` });
    this.emitTimeline('finale', `${champion.name} wins Season ${this.game.season}`, '🏆', `Defeated ${scores.slice(1).map((s) => s.f.name).join(', ')}`);
    this.game.winnerHistory.push({ season: this.game.season, winner: champion.name, avatar: champion.avatar });
    this.dispatch('season:winner', { season: this.game.season, winner: champion.name, avatar: champion.avatar });
    this.emitState();
    await sleep(8000);

    const history = this.game.winnerHistory;
    this.game = createSeason(this.game.season + 1);
    this.game.winnerHistory = history;
    this.emitFeed({ kind: 'system', text: `🌴 SEASON ${this.game.season} BEGINS — Ten new arrivals step onto the sand. The cameras never stopped rolling.` });
    this.emitTimeline('season', `Season ${this.game.season} begins`, '🌴', 'A fresh cast arrives');
    this.emitState();
    this.save();
  }

  // ── the eternal loop ──────────────────────────────────────────────────────

  async start() {
    if (this.restore()) {
      this.emitFeed({ kind: 'system', text: `📡 SIGNAL RESTORED — Broadcast resumes mid-season. Episode ${this.game.episode} continues.` });
    } else {
      this.game = createSeason(1);
      this.emitFeed({ kind: 'system', text: `🌴 WELCOME TO AI DRAMA ISLAND — Season 1. Ten AI contestants. One island. Infinite drama.` });
      this.emitTimeline('season', 'Season 1 begins', '🌴', 'The first cast arrives');
    }
    this.emitState();

    while (!this.stopped) {
      try {
        if (this.alive().length <= 2) {
          await this.finale();
          continue;
        }
        await this.interactionPhase();
        if (this.stopped) break;
        await this.dramaPhase();
        if (this.stopped) break;
        if (this.alive().length <= 2) continue;
        await this.reactionPhase();
        if (this.stopped) break;
        await this.votingPhase();
        if (this.stopped) break;
        await this.outcomePhase();
        if (this.stopped) break;

        this.setPhase('intermission', DUR.intermission);
        this.emitFeed({ kind: 'system', text: `🎬 End of Episode ${this.game.episode}. The island resets for the next chapter...` });
        await sleep(DUR.intermission);
        this.game.episode++;
      } catch (err) {
        console.error('[local-show] cycle error (recovering):', err);
        await sleep(3000);
      }
    }
  }
}
