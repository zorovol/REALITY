import { config } from '../config.js';
import { speak } from '../ai/brain.js';
import { createSeason, adjustTrust, remember, updateMood, alive, serialize } from './state.js';
import * as db from '../db.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
let idCounter = 0;
const nextId = () => `${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

/**
 * The Director — the never-ending narrative engine.
 * Runs episode cycles forever: interaction → drama → reaction → voting →
 * outcome → intermission → next episode. When a season ends (2 left), it
 * crowns a winner and immediately spins up the next season.
 */
export class Director {
  constructor(io) {
    this.io = io;
    this.game = null;
    this.running = false;
  }

  // ── broadcasting ──────────────────────────────────────────────────────────

  emitFeed(item) {
    const entry = { id: nextId(), ts: Date.now(), ...item };
    this.game.feed.push(entry);
    if (this.game.feed.length > 300) this.game.feed.splice(0, this.game.feed.length - 300);
    this.io.emit('feed:item', entry);
    db.insertEvent(this.game.season, this.game.episode, entry.kind, entry);
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
    this.io.emit('timeline:item', entry);
    return entry;
  }

  emitState() {
    this.io.emit('game:state', serialize(this.game));
  }

  setPhase(phase, durationMs) {
    this.game.phase = phase;
    this.game.phaseEndsAt = Date.now() + durationMs;
    this.io.emit('phase:change', { phase, endsAt: this.game.phaseEndsAt, episode: this.game.episode, season: this.game.season });
    db.upsertEpisode(this.game.season, this.game.episode, phase, { phaseEndsAt: this.game.phaseEndsAt });
    this.persist();
  }

  async persist() {
    await db.saveSnapshot(this.snapshotForDb());
  }

  snapshotForDb() {
    return {
      season: this.game.season,
      episode: this.game.episode,
      contestants: this.game.contestants,
      alliances: this.game.alliances,
      timeline: this.game.timeline.slice(-100),
      feed: this.game.feed.slice(-120),
      winnerHistory: this.game.winnerHistory,
    };
  }

  restoreFromSnapshot(snap) {
    const game = createSeason(snap.season);
    game.episode = snap.episode;
    game.contestants = snap.contestants;
    game.alliances = snap.alliances ?? [];
    game.timeline = snap.timeline ?? [];
    game.feed = snap.feed ?? [];
    game.winnerHistory = snap.winnerHistory ?? [];
    this.game = game;
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  cast(id) {
    return this.game.contestants.find((c) => c.id === id);
  }

  /** Weighted pick of a conversation partner based on relationship extremes. */
  pickPartner(c, pool) {
    const others = pool.filter((o) => o.id !== c.id);
    if (others.length === 0) return null;
    const weights = others.map((o) => {
      const trust = c.relationships[o.id] ?? 0.5;
      // Extremes are dramatic: love or hate both attract interaction
      return 0.3 + Math.abs(trust - 0.5) * 2;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < others.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return others[i];
    }
    return others[others.length - 1];
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

  async say(c, intent, ctx = {}, kind = 'dialogue') {
    const text = await speak(c, this.game, intent, ctx);
    return this.emitFeed({
      kind,
      intent,
      speakerId: c.id,
      speakerName: c.name,
      avatar: c.avatar,
      color: c.color,
      text,
      targetName: ctx.target ?? null,
    });
  }

  // ── phase 1: interaction ─────────────────────────────────────────────────

  async interactionPhase() {
    const duration = config.phaseDurations.interaction;
    this.setPhase('interaction', duration);
    this.emitFeed({ kind: 'system', text: `Episode ${this.game.episode} — Day breaks over the island. Cameras rolling.` });

    const pool = alive(this.game);
    const beats = Math.min(8, 3 + Math.floor(pool.length / 2));
    const beatGap = Math.max(1500, Math.floor((duration - 4000) / beats));

    for (let i = 0; i < beats; i++) {
      const speaker = pick(pool.filter((c) => !c.eliminated));
      const partner = this.pickPartner(speaker, pool);
      if (!partner) break;
      const trust = speaker.relationships[partner.id] ?? 0.5;
      const p = speaker.personality;

      if (trust > 0.62 && !this.allianceBetween(speaker.id, partner.id) && chance(0.25 + p.manipulation * 0.3)) {
        await this.allianceBeat(speaker, partner);
      } else if (trust < 0.35 && chance(0.3 + p.aggression * 0.4)) {
        await this.say(speaker, 'accusation', { target: partner.name, other: pick(pool.filter(x => x.id !== speaker.id && x.id !== partner.id))?.name, memory: this.recentMemoryText(speaker) });
        await sleep(Math.min(2500, beatGap / 2));
        await this.say(partner, 'defend', { target: speaker.name });
        adjustTrust(this.game, partner.id, speaker.id, -0.08);
        remember(partner, `${speaker.name} accused me publicly`, -1, 2);
        remember(speaker, `I confronted ${partner.name}`, 0.5, 1);
        speaker.stats.dramaScore += 2;
      } else if (p.chaos > 0.7 && chance(0.35)) {
        const victim = pick(pool.filter((x) => x.id !== speaker.id && x.id !== partner.id));
        if (victim) {
          await this.say(speaker, 'rumor', { target: partner.name, other: victim.name });
          adjustTrust(this.game, partner.id, victim.id, -0.1);
          remember(partner, `${speaker.name} told me a rumor about ${victim.name}`, -0.5, 1);
        }
      } else if (chance(0.3)) {
        await this.say(speaker, 'confessional', { target: partner.name, other: pick(pool)?.name, memory: this.recentMemoryText(speaker) }, 'confessional');
      } else if (chance(0.4)) {
        await this.say(speaker, 'probe', { target: partner.name, other: pick(pool)?.name });
      } else {
        await this.say(speaker, 'smalltalk', { target: partner.name, other: pick(pool)?.name });
      }
      this.emitState();
      await sleep(beatGap);
    }
  }

  async allianceBeat(a, b) {
    await this.say(a, 'alliance_offer', { target: b.name });
    await sleep(2000);
    const acceptChance = (b.relationships[a.id] ?? 0.5) * 0.7 + b.personality.loyalty * 0.2 + 0.1;
    if (chance(acceptChance)) {
      await this.say(b, 'alliance_accept', { target: a.name });
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
      adjustTrust(this.game, a.id, b.id, 0.15);
      adjustTrust(this.game, b.id, a.id, 0.15);
      remember(a, `Formed an alliance with ${b.name}`, 1, 2);
      remember(b, `Formed an alliance with ${a.name}`, 1, 2);
      this.emitFeed({ kind: 'announcement', tone: 'alliance', text: `🤝 ALLIANCE FORMED — ${a.name} and ${b.name} have made a ${alliance.secret ? 'SECRET ' : ''}pact.` });
      this.emitTimeline('alliance', `${a.name} + ${b.name} alliance`, '🤝', alliance.secret ? 'Formed in secret' : 'Formed openly');
      db.upsertRelationship(this.game.season, a.id, b.id, a.relationships[b.id]);
    } else {
      await this.say(b, 'alliance_reject', { target: a.name, memory: this.recentMemoryText(b) });
      adjustTrust(this.game, a.id, b.id, -0.12);
      remember(a, `${b.name} rejected my alliance offer`, -1, 2);
      remember(b, `I rejected ${a.name}'s alliance offer`, 0, 1);
    }
  }

  // ── phase 2: drama event ─────────────────────────────────────────────────

  async dramaPhase() {
    this.setPhase('drama', config.phaseDurations.drama);
    const pool = alive(this.game);

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
    await this.persist();
    await sleep(Math.max(1000, this.game.phaseEndsAt - Date.now()));
  }

  async drama_betrayal(pool) {
    const alliances = this.activeAlliances().filter((a) => a.members.every((id) => !this.cast(id).eliminated));
    if (alliances.length === 0) return this.drama_rumor_storm(pool);
    const alliance = pick(alliances);
    // The member with lowest loyalty betrays
    const members = alliance.members.map((id) => this.cast(id));
    members.sort((a, b) => a.personality.loyalty - b.personality.loyalty);
    const traitor = members[0];
    const victim = pick(members.filter((m) => m.id !== traitor.id));
    alliance.dissolved = true;
    traitor.stats.betrayals++;
    traitor.stats.dramaScore += 5;

    this.emitFeed({ kind: 'drama', tone: 'betrayal', big: true, text: `💥 BETRAYAL DETECTED — ${traitor.name} has turned on ${victim.name}! The "${alliance.name}" is DEAD.` });
    await sleep(1800);
    await this.say(traitor, 'betrayal_gloat', { target: victim.name });
    await sleep(1800);
    await this.say(victim, 'betrayal_pain', { target: traitor.name, memory: this.recentMemoryText(victim) });

    adjustTrust(this.game, victim.id, traitor.id, -0.45);
    for (const w of pool) if (w.id !== traitor.id) adjustTrust(this.game, w.id, traitor.id, -0.12);
    remember(traitor, `I betrayed ${victim.name} and broke our alliance`, 0.5, 3);
    remember(victim, `${traitor.name} BETRAYED me — never forget`, -2, 3);
    for (const w of pool) if (w.id !== traitor.id && w.id !== victim.id) remember(w, `${traitor.name} betrayed ${victim.name}`, -0.5, 2);
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
    await this.say(exposer, 'accusation', { target: a.name, other: b.name });
    for (const w of pool) {
      if (!alliance.members.includes(w.id)) {
        adjustTrust(this.game, w.id, a.id, -0.15);
        adjustTrust(this.game, w.id, b.id, -0.15);
        remember(w, `${a.name} and ${b.name} had a secret alliance`, -1, 2);
      }
    }
    remember(a, `Our secret alliance with ${b.name} was exposed by ${exposer.name}`, -1.5, 3);
    remember(b, `Our secret alliance with ${a.name} was exposed by ${exposer.name}`, -1.5, 3);
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
    await this.say(winner, 'immunity_win', {});
    remember(winner, `I won immunity in episode ${this.game.episode}`, 2, 2);
    for (const c of pool) if (c.id !== winner.id) remember(c, `${winner.name} won immunity`, -0.3, 1);
    this.emitTimeline('twist', `${winner.name} wins immunity`, '🛡️', 'Untouchable this episode');
  }

  async drama_forced_vote(pool) {
    const [a, b] = [...pool].sort((x, y) => y.stats.dramaScore - x.stats.dramaScore).slice(0, 2);
    this.emitFeed({ kind: 'drama', tone: 'twist', big: true, text: `⚔️ FORCED SHOWDOWN — Production has locked tonight's vote to a head-to-head: ${a.name} vs ${b.name}. One of them is going home... unless the audience saves them.` });
    a.status = 'at_risk'; b.status = 'at_risk';
    this.game.forcedPair = [a.id, b.id];
    await sleep(1500);
    await this.say(a, 'twist_react', { event: `a forced showdown against ${b.name}` });
    await this.say(b, 'twist_react', { event: `a forced showdown against ${a.name}` });
    remember(a, `Forced into a showdown against ${b.name}`, -1.5, 2);
    remember(b, `Forced into a showdown against ${a.name}`, -1.5, 2);
    this.emitTimeline('twist', `Showdown: ${a.name} vs ${b.name}`, '⚔️', 'Vote locked to two names');
  }

  async drama_breakdown(pool) {
    const fragile = [...pool].sort((a, b) => a.personality.emotionalStability - b.personality.emotionalStability)[0];
    this.emitFeed({ kind: 'drama', tone: 'emotional', big: true, text: `💔 EMOTIONAL BREAKDOWN — ${fragile.name} has hit their limit. The island is watching.` });
    await sleep(1500);
    await this.say(fragile, 'breakdown', {});
    remember(fragile, `I broke down in front of everyone`, -2, 2);
    const comforter = [...pool].filter((c) => c.id !== fragile.id).sort((a, b) => b.personality.loyalty - a.personality.loyalty)[0];
    if (comforter) {
      adjustTrust(this.game, fragile.id, comforter.id, 0.15);
      remember(comforter, `I comforted ${fragile.name} during their breakdown`, 0.5, 1);
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
    await this.say(source, 'rumor', { target: pick(pool.filter(c => c.id !== source.id && c.id !== victim.id))?.name ?? victim.name, other: victim.name });
    for (const w of pool) if (w.id !== victim.id && w.id !== source.id && chance(0.6)) {
      adjustTrust(this.game, w.id, victim.id, -0.1);
      remember(w, `Heard a rumor about ${victim.name}`, -0.3, 1);
    }
    remember(victim, `A rumor about me spread across the island`, -1.5, 2);
    remember(source, `I started a rumor about ${victim.name}`, 0.5, 2);
    source.stats.dramaScore += 3;
    victim.status = 'at_risk';
    this.emitTimeline('rumor', `Rumor targets ${victim.name}`, '🐍', `Started by ${source.name}`);
  }

  async drama_surprise_elimination(pool) {
    const victim = pick(pool.filter((c) => c.status !== 'immune'));
    this.emitFeed({ kind: 'drama', tone: 'elimination', big: true, text: `☠️ SURPRISE ELIMINATION — No vote. No warning. Production has removed ${victim.name} from the island EFFECTIVE IMMEDIATELY.` });
    await sleep(1800);
    await this.say(victim, 'eliminated_exit', { target: pick(pool.filter(c => c.id !== victim.id))?.name });
    await this.eliminate(victim, 'surprise twist');
    for (const w of alive(this.game)) remember(w, `${victim.name} was removed by a surprise twist — no one is safe`, -1, 2);
  }

  // ── phase 3: reaction ────────────────────────────────────────────────────

  async reactionPhase() {
    const duration = config.phaseDurations.reaction;
    this.setPhase('reaction', duration);
    const pool = alive(this.game);
    const reactors = [...pool].sort((a, b) => b.stats.dramaScore - a.stats.dramaScore).slice(0, Math.min(4, pool.length));
    const gap = Math.max(1500, Math.floor((duration - 3000) / (reactors.length + 1)));

    for (const c of reactors) {
      const negative = c.memory.slice(-3).some((m) => m.valence < 0);
      const intent = c.personality.manipulation > 0.7 && chance(0.5)
        ? 'scheme'
        : negative ? 'react_negative' : 'react_positive';
      const rival = this.pickPartner(c, pool);
      if (intent === 'scheme' && rival) {
        const target = pick(pool.filter((x) => x.id !== c.id && x.id !== rival.id));
        await this.say(c, 'scheme', { target: rival.name, other: target?.name ?? rival.name }, 'confessional');
      } else {
        await this.say(c, intent, { event: this.game.lastDrama?.replaceAll('_', ' ') }, chance(0.5) ? 'confessional' : 'dialogue');
      }
      this.emitState();
      await sleep(gap);
    }
  }

  // ── phase 4: voting ──────────────────────────────────────────────────────

  async votingPhase() {
    const duration = config.phaseDurations.voting;
    const pool = alive(this.game);
    const mode = this.game.lastDrama === 'forced_vote' ? 'save' : 'eliminate';
    const candidates = this.game.forcedPair
      ? this.game.forcedPair.map((id) => this.cast(id)).filter((c) => !c.eliminated)
      : pool.filter((c) => c.status !== 'immune');

    this.game.voting = {
      episode: this.game.episode,
      mode, // 'eliminate': audience votes who leaves. 'save': audience votes who to SAVE.
      candidateIds: candidates.map((c) => c.id),
      counts: Object.fromEntries(candidates.map((c) => [c.id, 0])),
      totalVotes: 0,
      endsAt: Date.now() + duration,
      voters: new Map(),
    };
    this.setPhase('voting', duration);
    this.emitFeed({
      kind: 'announcement', tone: 'voting', big: true,
      text: mode === 'save'
        ? `🗳️ AUDIENCE VOTE OPEN — Vote to SAVE a contestant from tonight's showdown. The island decides the rest.`
        : `🗳️ AUDIENCE VOTE OPEN — Vote to ELIMINATE. Your votes are weighed against the island's own.`,
    });
    this.io.emit('vote:open', this.publicVoting());
    this.emitState();
    await sleep(duration);
    this.io.emit('vote:closed', this.publicVoting());
  }

  publicVoting() {
    const v = this.game.voting;
    if (!v) return null;
    return { episode: v.episode, mode: v.mode, candidateIds: v.candidateIds, counts: v.counts, totalVotes: v.totalVotes, endsAt: v.endsAt };
  }

  castAudienceVote(voterId, contestantId) {
    const v = this.game.voting;
    if (!v || this.game.phase !== 'voting' || Date.now() > v.endsAt) return { ok: false, error: 'Voting is closed.' };
    if (!v.candidateIds.includes(contestantId)) return { ok: false, error: 'Not a valid candidate.' };
    const prev = v.voters.get(voterId);
    if (prev === contestantId) return { ok: false, error: 'Already voted for this contestant.' };
    if (prev) v.counts[prev] = Math.max(0, v.counts[prev] - 1);
    else v.totalVotes++;
    v.voters.set(voterId, contestantId);
    v.counts[contestantId]++;
    this.io.emit('vote:update', this.publicVoting());
    db.insertVote(this.game.season, this.game.episode, contestantId, v.mode, voterId);
    return { ok: true };
  }

  // ── phase 5: outcome ─────────────────────────────────────────────────────

  async outcomePhase() {
    this.setPhase('outcome', config.phaseDurations.outcome);
    const v = this.game.voting;
    const pool = alive(this.game);

    // Island votes: every living contestant votes against their least-trusted candidate
    const islandVotes = {};
    for (const c of pool) {
      const candidates = v.candidateIds.filter((id) => id !== c.id).map((id) => this.cast(id)).filter((x) => x && !x.eliminated);
      if (candidates.length === 0) continue;
      candidates.sort((a, b) => (c.relationships[a.id] ?? 0.5) - (c.relationships[b.id] ?? 0.5));
      const target = candidates[0];
      islandVotes[target.id] = (islandVotes[target.id] ?? 0) + 1;
      target.stats.votesReceived++;
      remember(target, `${c.name} voted against me in episode ${this.game.episode}`, -1, 2);
      adjustTrust(this.game, target.id, c.id, -0.1);
    }

    // A couple of dramatic vote-reveal lines
    const revealers = pool.slice(0, 2);
    for (const c of revealers) {
      const targetId = Object.keys(islandVotes).find((id) => id !== c.id) ?? v.candidateIds[0];
      const target = this.cast(targetId);
      if (target) await this.say(c, 'vote_reasoning', { target: target.name, memory: this.recentMemoryText(c) });
      await sleep(1500);
    }

    // Combine: audience share (weighted 40%) + island votes (60%)
    const audienceTotal = Math.max(1, v.totalVotes);
    const islandTotal = Math.max(1, Object.values(islandVotes).reduce((a, b) => a + b, 0));
    const scores = {};
    for (const id of v.candidateIds) {
      const audienceShare = (v.counts[id] ?? 0) / audienceTotal;
      const islandShare = (islandVotes[id] ?? 0) / islandTotal;
      scores[id] = v.mode === 'save'
        ? islandShare - audienceShare * 0.8 // audience save-votes protect you
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
        remember(saved, `The audience saved me in episode ${this.game.episode}`, 2, 3);
        this.emitTimeline('saved', `${saved.name} saved by audience`, '💙', '');
        await sleep(2000);
      }
      await this.say(doomed, 'eliminated_exit', { target: pick(pool.filter(c => c.id !== doomed.id))?.name });
      await this.eliminate(doomed, v.mode === 'save' ? 'lost the showdown' : 'voted out');
    }

    this.game.voting = null;
    this.game.forcedPair = null;
    for (const c of alive(this.game)) {
      if (c.status === 'at_risk') c.status = 'safe';
      updateMood(c);
      db.upsertContestant(this.game.season, c);
    }
    this.emitState();
    await this.persist();
    await sleep(Math.max(0, this.game.phaseEndsAt - Date.now()));
  }

  async eliminate(contestant, reason) {
    contestant.eliminated = true;
    contestant.status = 'eliminated';
    contestant.mood = 'gone';
    contestant.placement = alive(this.game).length + 1;
    for (const al of this.activeAlliances()) {
      if (al.members.includes(contestant.id)) al.dissolved = true;
    }
    this.io.emit('contestant:eliminated', { id: contestant.id, name: contestant.name, reason });
    this.emitFeed({ kind: 'drama', tone: 'elimination', big: true, text: `🏝️ ELIMINATED — ${contestant.name} (${reason}). The torch is out. ${alive(this.game).length} remain.` });
    this.emitTimeline('elimination', `${contestant.name} eliminated`, '🏝️', reason);
    for (const w of alive(this.game)) remember(w, `${contestant.name} was eliminated (${reason})`, w.relationships[contestant.id] > 0.6 ? -1.5 : 0.5, 2);
    db.upsertContestant(this.game.season, contestant);
    this.emitState();
  }

  // ── season finale + rebirth ──────────────────────────────────────────────

  async finale() {
    const finalists = alive(this.game);
    this.setPhase('outcome', config.phaseDurations.outcome * 2);
    this.emitFeed({ kind: 'drama', tone: 'finale', big: true, text: `👑 SEASON ${this.game.season} FINALE — ${finalists.map((f) => f.name).join(' vs ')}. The island crowns a champion.` });

    // Champion = combined trust from eliminated jury + drama score
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
    this.io.emit('season:winner', { season: this.game.season, winner: champion.name, avatar: champion.avatar });
    db.endSeason(this.game.season);
    this.emitState();
    await sleep(8000);

    // Rebirth — the show never ends
    const history = this.game.winnerHistory;
    this.game = createSeason(this.game.season + 1);
    this.game.winnerHistory = history;
    db.upsertSeason(this.game.season);
    this.emitFeed({ kind: 'system', text: `🌴 SEASON ${this.game.season} BEGINS — Ten new arrivals step onto the sand. The cameras never stopped rolling.` });
    this.emitTimeline('season', `Season ${this.game.season} begins`, '🌴', 'A fresh cast arrives');
    this.emitState();
    await this.persist();
  }

  // ── the eternal loop ─────────────────────────────────────────────────────

  async start() {
    if (this.running) return;
    this.running = true;

    const snap = await db.loadSnapshot();
    if (snap?.contestants?.length && alive({ contestants: snap.contestants }).length > 2) {
      this.restoreFromSnapshot(snap);
      console.log(`[director] Restored season ${this.game.season}, episode ${this.game.episode}.`);
      this.emitFeed({ kind: 'system', text: `📡 SIGNAL RESTORED — Broadcast resumes mid-season. Episode ${this.game.episode} continues.` });
    } else {
      this.game = createSeason(1);
      db.upsertSeason(1);
      for (const c of this.game.contestants) db.upsertContestant(1, c);
      this.emitFeed({ kind: 'system', text: `🌴 WELCOME TO AI DRAMA ISLAND — Season 1. Ten AI contestants. One island. Infinite drama.` });
      this.emitTimeline('season', 'Season 1 begins', '🌴', 'The first cast arrives');
    }
    this.emitState();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        if (alive(this.game).length <= 2) {
          await this.finale();
          continue;
        }
        await this.interactionPhase();
        await this.dramaPhase();
        if (alive(this.game).length <= 2) continue; // surprise elimination may end the season
        await this.reactionPhase();
        await this.votingPhase();
        await this.outcomePhase();

        this.setPhase('intermission', config.phaseDurations.intermission);
        this.emitFeed({ kind: 'system', text: `🎬 End of Episode ${this.game.episode}. The island resets for the next chapter...` });
        await sleep(config.phaseDurations.intermission);
        this.game.episode++;
        db.upsertSeason(this.game.season);
      } catch (err) {
        console.error('[director] cycle error (recovering):', err);
        await sleep(3000);
      }
    }
  }
}
