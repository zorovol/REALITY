import { CAST_POOL } from './cast.js';

/**
 * WorldEngine — the continuous, real-time reality-show simulation.
 *
 * This file is ISOMORPHIC: it runs on the server (broadcast via Socket.io)
 * and in the browser (local fallback mode). It has no Node or DOM
 * dependencies; the host injects `dispatch`, `gen`, `save`, and `restore`.
 *
 * There are no turns, no episodes, no resets:
 *  - Movement loop (10 Hz): smooth agent motion, pathing, zone drift
 *  - Micro-interaction loop (every 250–700ms): pick agents, generate
 *    proximity-based micro-events, update memory + relationships
 *  - Director loop (~every 900ms): tension tracking, quiet detection,
 *    catalysts, forced collisions, betrayal scheduling, arc management,
 *    audience votes, returnee twists
 *  - Speech is emitted as events; clients render letter-by-letter typing
 *    above each agent's head.
 */

export const WORLD = { w: 1000, h: 600 };

export const ZONES = [
  { id: 'safe', name: 'Cove of Calm', x: 200, y: 160, r: 150, type: 'safe' },
  { id: 'conflict', name: 'Fire Pit', x: 690, y: 260, r: 165, type: 'conflict' },
  { id: 'mystery', name: 'Whisper Jungle', x: 380, y: 460, r: 140, type: 'mystery' },
];

const DOCK = { x: 60, y: 545 };

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
let idCounter = 0;
const nextId = () => `w${Date.now().toString(36)}${(idCounter++).toString(36)}`;

const ARC_NAMES = {
  hot: ['Trust Collapse', 'War of Whispers', 'Knives Out', 'The Reckoning', 'Blood in the Water'],
  cold: ['The Quiet Before', 'False Peace', 'Sunlit Schemes', 'Calm Tides', 'Smiles and Daggers'],
  mid: ['Power Vacuum', 'Rebellion Rising', 'Shifting Sands', 'Paranoia Spiral', 'The Long Game'],
};

const EMOTION_BY_INTENT = {
  accusation: 'anger', defend: 'anger', betrayal_gloat: 'anger', betrayal_pain: 'anger',
  breakdown: 'fear', mutter: 'fear', storm_react: 'fear', react_negative: 'fear',
  alliance_offer: 'alliance', alliance_accept: 'alliance', scheme: 'alliance',
  returnee: 'anger', idol_found: 'alliance',
};

function makeAgent(template) {
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
    // ── live state ──
    active: true,
    status: 'safe', // safe | at_risk | immune | eliminated
    state: {
      mood: 'calm', // angry | calm | paranoid | excited | sad
      energy: 60 + Math.random() * 40,
      intent: 'wander', // wander | seek_alliance | confront | explore | isolate
      focusTarget: null,
    },
    pos: {
      x: 150 + Math.random() * (WORLD.w - 300),
      y: 120 + Math.random() * (WORLD.h - 240),
    },
    target: null,
    speed: 34 + Math.random() * 22,
    idleUntil: 0,
    cooldownUntil: 0,
    speakingUntil: 0,
    plannedBetrayal: null, // victim id when the director has seeded a betrayal
    timesEliminated: 0,
    // ── long-term memory ──
    memory: {
      events: [], // { type, target, intensity, text, ts }
      relationships: {}, // id -> { trust: -100..100, fear: 0..100, loyalty: 0..100 }
      grudges: [],
      alliances: [],
      goals: [template.hiddenMotivation],
    },
    stats: { betrayals: 0, alliancesFormed: 0, votesReceived: 0, dramaScore: 0 },
  };
}

export class WorldEngine {
  /**
   * @param {object} opts
   * @param {(event: string, payload: any) => void} opts.dispatch
   * @param {(agent, intent, ctx, world) => Promise<string>|string} opts.gen
   * @param {(snapshot: object) => void} [opts.save]
   * @param {() => Promise<object|null>|object|null} [opts.restore]
   * @param {number} [opts.speed] pacing multiplier for director cadence
   */
  constructor({ dispatch, gen, save, restore, speed = 1 }) {
    this.dispatch = dispatch;
    this.gen = gen;
    this.saveFn = save ?? (() => {});
    this.restoreFn = restore ?? (() => null);
    this.speed = Math.max(0.25, speed);

    this.agents = [];
    this.alliances = [];
    this.feed = [];
    this.timeline = [];
    this.voting = null;
    this.tension = 20;
    this.arc = null;
    this.arcNumber = 0;
    this.zones = ZONES.map((z) => ({ ...z, intensity: z.type === 'conflict' ? 0.5 : 0.25 }));
    this.startedAt = Date.now();
    this.lastEventAt = Date.now();
    this.lastVoteAt = Date.now();
    this.recentConflicts = [];
    this.timers = [];
    this.stopped = false;

    this.voteIntervalMs = 200_000 / this.speed;
    this.voteDurationMs = Math.max(20_000, 40_000 / this.speed);
    this.arcMaxAgeMs = 300_000 / this.speed;
  }

  // ── relationships & memory ─────────────────────────────────────────────

  agent(id) {
    return this.agents.find((a) => a.id === id);
  }

  activeAgents() {
    return this.agents.filter((a) => a.active);
  }

  rel(a, otherId) {
    if (!a.memory.relationships[otherId]) {
      // wide starting spread: some pairs click instantly, some start as rivals
      a.memory.relationships[otherId] = {
        trust: Math.round((Math.random() - 0.5) * 64),
        fear: Math.round(Math.random() * 22),
        loyalty: 0,
      };
    }
    return a.memory.relationships[otherId];
  }

  shiftRel(a, otherId, { trust = 0, fear = 0, loyalty = 0 }) {
    if (a.id === otherId) return;
    const r = this.rel(a, otherId);
    r.trust = clamp(r.trust + trust, -100, 100);
    r.fear = clamp(r.fear + fear, 0, 100);
    r.loyalty = clamp(r.loyalty + loyalty, 0, 100);
    this.refreshGrudges(a);
  }

  refreshGrudges(a) {
    a.memory.grudges = Object.entries(a.memory.relationships)
      .filter(([id, r]) => r.trust <= -45 && this.agent(id)?.active)
      .map(([id]) => id);
  }

  remember(a, { type, target = null, intensity = 0, text }) {
    a.memory.events.push({ type, target, intensity, text, ts: Date.now() });
    if (a.memory.events.length > 60) {
      a.memory.events.sort((x, y) => Math.abs(x.intensity) - Math.abs(y.intensity) || x.ts - y.ts);
      a.memory.events.splice(0, a.memory.events.length - 60);
      a.memory.events.sort((x, y) => x.ts - y.ts);
    }
    this.updateMood(a);
  }

  updateMood(a) {
    if (!a.active) { a.state.mood = 'gone'; return; }
    const recent = a.memory.events.slice(-6);
    const s = recent.reduce((sum, e) => sum + e.intensity, 0);
    const p = a.personality;
    const fearAvg = Object.values(a.memory.relationships).reduce((sum, r) => sum + r.fear, 0)
      / Math.max(1, Object.keys(a.memory.relationships).length);
    let mood = 'calm';
    if (s <= -60) mood = p.aggression > 0.5 ? 'angry' : 'sad';
    else if ((p.emotionalStability < 0.4 && s < 0) || fearAvg > 45) mood = 'paranoid';
    else if (s >= 45) mood = 'excited';
    if (a.state.mood !== mood) {
      a.state.mood = mood;
      this.dispatch('agent:state', this.publicAgent(a));
    }
  }

  heaviestMemory(a) {
    const heavy = [...a.memory.events].sort((x, y) => Math.abs(y.intensity) - Math.abs(x.intensity))[0];
    return heavy?.text ?? 'everything that has happened here';
  }

  // ── broadcast helpers ──────────────────────────────────────────────────

  emitFeed(item) {
    const entry = { id: nextId(), ts: Date.now(), ...item };
    this.feed.push(entry);
    if (this.feed.length > 300) this.feed.splice(0, this.feed.length - 300);
    this.lastEventAt = Date.now();
    this.dispatch('feed:item', entry);
    return entry;
  }

  emitTimeline(type, label, icon, detail = '') {
    const entry = { id: nextId(), ts: Date.now(), arc: this.arcNumber, type, label, icon, detail };
    this.timeline.push(entry);
    if (this.timeline.length > 200) this.timeline.splice(0, this.timeline.length - 200);
    this.dispatch('timeline:item', entry);
  }

  publicAgent(a) {
    return {
      id: a.id, name: a.name, modelLabel: a.modelLabel, avatar: a.avatar,
      color: a.color, tagline: a.tagline,
      active: a.active, status: a.status,
      mood: a.state.mood,
      energy: Math.round(a.state.energy),
      intent: a.state.intent,
      focusTarget: a.state.focusTarget,
      pos: { x: Math.round(a.pos.x), y: Math.round(a.pos.y) },
      grudges: a.memory.grudges,
      allies: this.alliances.filter((al) => !al.dissolved && al.members.includes(a.id))
        .flatMap((al) => al.members.filter((m) => m !== a.id)),
      trust: Object.fromEntries(Object.entries(a.memory.relationships).map(([id, r]) => [id, r.trust])),
      stats: a.stats,
      timesEliminated: a.timesEliminated,
    };
  }

  serialize() {
    return {
      startedAt: this.startedAt,
      arc: this.arc,
      tension: Math.round(this.tension),
      zones: this.zones,
      agents: this.agents.map((a) => this.publicAgent(a)),
      alliances: this.alliances.filter((al) => !al.dissolved),
      feed: this.feed.slice(-120),
      timeline: this.timeline.slice(-100),
      voting: this.publicVoting(),
    };
  }

  emitState() {
    this.dispatch('world:state', this.serialize());
  }

  snapshot() {
    return {
      v: 5,
      agents: this.agents,
      alliances: this.alliances,
      arc: this.arc,
      arcNumber: this.arcNumber,
      tension: this.tension,
      feed: this.feed.slice(-120),
      timeline: this.timeline.slice(-100),
      startedAt: this.startedAt,
    };
  }

  persist() {
    try { this.saveFn(this.snapshot()); } catch { /* persistence must never stall the world */ }
  }

  // ── speech ─────────────────────────────────────────────────────────────

  async speak(a, intent, ctx = {}, kind = 'dialogue') {
    if (!a.active) return;
    const nowTs = Date.now();
    if (nowTs < a.speakingUntil) return; // don't talk over yourself
    let text;
    try {
      text = await this.gen(a, intent, ctx, this);
    } catch {
      text = null;
    }
    if (!text) return;
    const emotion = ctx.emotion ?? EMOTION_BY_INTENT[intent] ?? 'neutral';
    const durationMs = Math.max(2600, text.length * 34 + 2200);
    a.speakingUntil = Date.now() + durationMs;
    this.dispatch('agent:speak', {
      agentId: a.id, name: a.name, color: a.color,
      text, emotion, intent, durationMs, ts: Date.now(),
    });
    this.emitFeed({
      kind, intent,
      speakerId: a.id, speakerName: a.name, avatar: a.avatar, color: a.color,
      text, targetName: ctx.target ?? null,
    });
  }

  // ── movement (10 Hz) ───────────────────────────────────────────────────

  movementTick() {
    const dt = 0.1;
    const nowTs = Date.now();
    for (const a of this.agents) {
      if (!a.active) continue;

      // energy: regenerate while idle, faster inside the safe zone
      const inSafe = dist(a.pos, this.zones[0]) < this.zones[0].r;
      a.state.energy = clamp(a.state.energy + (a.target ? -0.06 : inSafe ? 0.5 : 0.2), 0, 100);

      if (nowTs < a.idleUntil) continue;

      // chase / follow: keep target glued to a moving focus
      if ((a.state.intent === 'confront' || a.state.intent === 'seek_alliance') && a.state.focusTarget) {
        const focus = this.agent(a.state.focusTarget);
        if (focus?.active) {
          if (dist(a.pos, focus.pos) > 70) {
            a.target = { x: focus.pos.x + (Math.random() - 0.5) * 40, y: focus.pos.y + (Math.random() - 0.5) * 40 };
          }
        } else {
          a.state.focusTarget = null;
          a.state.intent = 'wander';
          a.target = null;
        }
      }

      if (!a.target) {
        this.chooseDestination(a);
        continue;
      }

      const d = dist(a.pos, a.target);
      const speed = a.speed * (a.state.mood === 'angry' ? 1.35 : a.state.energy < 25 ? 0.6 : 1);
      if (d < speed * dt + 2) {
        a.pos = { ...a.target };
        a.target = null;
        a.idleUntil = nowTs + 800 + Math.random() * 5200; // stand around — silence is realism
        if (chance(0.4)) this.chooseIntent(a);
      } else {
        a.pos.x += ((a.target.x - a.pos.x) / d) * speed * dt;
        a.pos.y += ((a.target.y - a.pos.y) / d) * speed * dt;
      }
      a.pos.x = clamp(a.pos.x, 30, WORLD.w - 30);
      a.pos.y = clamp(a.pos.y, 40, WORLD.h - 30);
    }
    // positions broadcast: tiny payload, 10 Hz
    this.dispatch('world:positions', {
      t: nowTs,
      p: this.agents.filter((a) => a.active).map((a) => [a.id, Math.round(a.pos.x), Math.round(a.pos.y)]),
    });
  }

  chooseIntent(a) {
    const p = a.personality;
    const others = this.activeAgents().filter((o) => o.id !== a.id);
    if (others.length === 0) return;

    const grudgeTargets = a.memory.grudges.map((id) => this.agent(id)).filter((g) => g?.active);
    const allies = others.filter((o) => this.rel(a, o.id).trust > 35);

    if (a.plannedBetrayal && this.agent(a.plannedBetrayal)?.active) {
      a.state.intent = 'confront';
      a.state.focusTarget = a.plannedBetrayal;
    } else if (grudgeTargets.length && p.aggression > 0.45 && a.state.energy > 35 && chance(0.5)) {
      a.state.intent = 'confront';
      a.state.focusTarget = pick(grudgeTargets).id;
    } else if (a.state.energy < 25 || (a.state.mood === 'sad' && chance(0.6))) {
      a.state.intent = 'isolate';
      a.state.focusTarget = null;
    } else if (allies.length && chance(0.3 + p.loyalty * 0.25)) {
      a.state.intent = 'seek_alliance';
      a.state.focusTarget = pick(allies).id;
    } else if (chance(p.chaos * 0.45)) {
      a.state.intent = 'explore';
      a.state.focusTarget = null;
    } else {
      a.state.intent = 'wander';
      a.state.focusTarget = null;
    }
    this.dispatch('agent:state', this.publicAgent(a));
  }

  chooseDestination(a) {
    const jitter = (r) => (Math.random() - 0.5) * r * 1.4;
    switch (a.state.intent) {
      case 'isolate': {
        const z = this.zones[0];
        a.target = { x: z.x + jitter(z.r), y: z.y + jitter(z.r) };
        break;
      }
      case 'explore': {
        const z = this.zones[2];
        a.target = { x: z.x + jitter(z.r), y: z.y + jitter(z.r) };
        break;
      }
      case 'confront':
      case 'seek_alliance': {
        const focus = this.agent(a.state.focusTarget);
        if (focus?.active) {
          a.target = { x: focus.pos.x + jitter(60), y: focus.pos.y + jitter(60) };
        } else {
          a.state.intent = 'wander';
          a.target = null;
        }
        break;
      }
      default: {
        // wander: drama-hungry agents drift toward the fire pit
        const z = chance(0.35 + a.personality.chaos * 0.25) ? this.zones[1] : pick(this.zones);
        a.target = chance(0.75)
          ? { x: z.x + jitter(z.r), y: z.y + jitter(z.r) }
          : { x: 60 + Math.random() * (WORLD.w - 120), y: 70 + Math.random() * (WORLD.h - 130) };
      }
    }
    if (a.target) {
      a.target.x = clamp(a.target.x, 40, WORLD.w - 40);
      a.target.y = clamp(a.target.y, 50, WORLD.h - 40);
    }
  }

  // ── micro-interactions (every 250–700ms) ───────────────────────────────

  scheduleMicro() {
    if (this.stopped) return;
    const t = setTimeout(async () => {
      try { await this.microTick(); } catch (err) { console.error('[world] micro error:', err); }
      this.scheduleMicro();
    }, 250 + Math.random() * 450);
    this.timers.push(t);
  }

  async microTick() {
    const pool = this.activeAgents();
    if (pool.length < 2) return;
    const nowTs = Date.now();
    const ready = pool.filter((a) => nowTs > a.cooldownUntil && nowTs > a.speakingUntil);
    if (ready.length === 0) return;
    const a = pick(ready);
    const near = pool.filter((o) => o.id !== a.id && dist(a.pos, o.pos) < 110);

    if (near.length === 0) {
      // alone: occasional confessional mutter — most of the time, silence
      if (chance(0.14)) {
        a.cooldownUntil = nowTs + 9000 + Math.random() * 8000;
        await this.speak(a, chance(0.5) ? 'mutter' : 'confessional', {
          other: pick(pool.filter((o) => o.id !== a.id))?.name,
          target: pick(pool.filter((o) => o.id !== a.id))?.name,
          memory: this.heaviestMemory(a),
        }, 'confessional');
      }
      return;
    }

    // partner choice: relationship extremes attract interaction
    const weighted = near.map((o) => ({ o, w: 0.3 + Math.abs(this.rel(a, o.id).trust) / 60 }));
    const total = weighted.reduce((s, x) => s + x.w, 0);
    let roll = Math.random() * total;
    let b = weighted[0].o;
    for (const x of weighted) { roll -= x.w; if (roll <= 0) { b = x.o; break; } }

    const r = this.rel(a, b.id);
    a.cooldownUntil = nowTs + 5000 + Math.random() * 6000; // max ~1-2 interactions / 10s / agent
    b.cooldownUntil = Math.max(b.cooldownUntil, nowTs + 3500);

    if (a.plannedBetrayal === b.id) return this.executeBetrayal(a, b);
    if (r.trust < -25 || a.memory.grudges.includes(b.id)) return this.confrontation(a, b);
    if (r.trust > 30 && !this.alliedWith(a, b) && chance(0.28 + a.personality.manipulation * 0.25)) {
      return this.allianceFlow(a, b);
    }
    if (a.personality.chaos > 0.65 && chance(0.35)) {
      const victim = pick(pool.filter((x) => x.id !== a.id && x.id !== b.id));
      if (victim) return this.rumorDrop(a, b, victim);
    }
    if (this.alliedWith(a, b) && chance(0.4)) {
      const target = pick(pool.filter((x) => x.id !== a.id && x.id !== b.id));
      await this.speak(a, 'scheme', { target: b.name, other: target?.name ?? b.name }, 'confessional');
      this.shiftRel(a, b.id, { trust: 2, loyalty: 2 });
      return;
    }
    await this.speak(a, chance(0.4) ? 'probe' : 'smalltalk', { target: b.name, other: pick(pool)?.name });
    this.shiftRel(a, b.id, { trust: chance(0.6) ? 2 : -2 });
    this.shiftRel(b, a.id, { trust: chance(0.6) ? 2 : -1 });
  }

  alliedWith(a, b) {
    return this.alliances.some((al) => !al.dissolved && al.members.includes(a.id) && al.members.includes(b.id));
  }

  async confrontation(a, b) {
    const memoryText = this.heaviestMemory(a);
    await this.speak(a, 'accusation', {
      target: b.name, memory: memoryText, emotion: 'anger',
      other: pick(this.activeAgents().filter((x) => x.id !== a.id && x.id !== b.id))?.name,
    });
    const reply = setTimeout(() => {
      this.speak(b, 'defend', { target: a.name, emotion: 'anger' });
    }, 1200 + Math.random() * 900);
    this.timers.push(reply);

    this.shiftRel(a, b.id, { trust: -6 });
    this.shiftRel(b, a.id, { trust: -9, fear: a.personality.aggression > 0.7 ? 6 : 2 });
    this.remember(a, { type: 'confronted', target: b.id, intensity: 10, text: `I confronted ${b.name}` });
    this.remember(b, { type: 'accused_by', target: a.id, intensity: -25, text: `${a.name} accused me in front of everyone` });
    a.stats.dramaScore += 2;
    a.state.energy = clamp(a.state.energy - 6, 0, 100);
    this.recentConflicts.push(Date.now());

    // bystanders take note
    for (const w of this.activeAgents()) {
      if (w.id !== a.id && w.id !== b.id && dist(w.pos, a.pos) < 160) {
        this.shiftRel(w, a.id, { fear: 3 });
        if (chance(0.4)) this.remember(w, { type: 'witnessed', target: a.id, intensity: -5, text: `Watched ${a.name} go after ${b.name}` });
      }
    }
    this.emitStoryEvent({
      cause: `${a.name} holds a grudge: "${memoryText}"`,
      context: `They crossed paths near ${this.nearestZone(a).name}`,
      reaction: `${a.name} confronted ${b.name} publicly`,
      consequence: 'Trust dropped; nearby agents grew wary',
    }, false);
  }

  async allianceFlow(a, b) {
    await this.speak(a, 'alliance_offer', { target: b.name, emotion: 'alliance' });
    const rb = this.rel(b, a.id);
    const accept = chance(clamp(0.35 + rb.trust / 150 + b.personality.loyalty * 0.25, 0.05, 0.9));
    const t = setTimeout(async () => {
      if (accept) {
        await this.speak(b, 'alliance_accept', { target: a.name, emotion: 'alliance' });
        const alliance = {
          id: nextId(), name: `${a.name} × ${b.name} Pact`,
          members: [a.id, b.id], secret: chance(0.6), formedAt: Date.now(), dissolved: false,
        };
        this.alliances.push(alliance);
        a.stats.alliancesFormed++; b.stats.alliancesFormed++;
        this.shiftRel(a, b.id, { trust: 14, loyalty: 15 });
        this.shiftRel(b, a.id, { trust: 14, loyalty: 15 });
        a.memory.alliances = [...new Set([...a.memory.alliances, b.id])];
        b.memory.alliances = [...new Set([...b.memory.alliances, a.id])];
        this.remember(a, { type: 'alliance', target: b.id, intensity: 30, text: `Formed a pact with ${b.name}` });
        this.remember(b, { type: 'alliance', target: a.id, intensity: 30, text: `Formed a pact with ${a.name}` });
        this.emitFeed({ kind: 'announcement', tone: 'alliance', text: `ALLIANCE FORMED — ${a.name} and ${b.name} made a ${alliance.secret ? 'SECRET ' : ''}pact.` });
        this.emitTimeline('alliance', `${a.name} + ${b.name} pact`, '', alliance.secret ? 'Formed in secret' : 'Formed openly');
      } else {
        await this.speak(b, 'alliance_reject', { target: a.name, memory: this.heaviestMemory(b) });
        this.shiftRel(a, b.id, { trust: -10 });
        this.remember(a, { type: 'rejected', target: b.id, intensity: -20, text: `${b.name} rejected my alliance offer` });
      }
    }, 1400 + Math.random() * 800);
    this.timers.push(t);
  }

  async rumorDrop(a, b, victim) {
    await this.speak(a, 'rumor', { target: b.name, other: victim.name });
    this.shiftRel(b, victim.id, { trust: -8 });
    this.remember(b, { type: 'heard_rumor', target: victim.id, intensity: -8, text: `${a.name} told me something dark about ${victim.name}` });
    this.remember(a, { type: 'spread_rumor', target: victim.id, intensity: 5, text: `I planted a rumor about ${victim.name}` });
    a.stats.dramaScore += 1;
  }

  async executeBetrayal(traitor, victim) {
    traitor.plannedBetrayal = null;
    const alliance = this.alliances.find((al) => !al.dissolved && al.members.includes(traitor.id) && al.members.includes(victim.id));
    if (alliance) alliance.dissolved = true;
    traitor.stats.betrayals++;
    traitor.stats.dramaScore += 5;
    traitor.memory.alliances = traitor.memory.alliances.filter((id) => id !== victim.id);
    victim.memory.alliances = victim.memory.alliances.filter((id) => id !== traitor.id);

    this.emitFeed({
      kind: 'drama', tone: 'betrayal', big: true,
      text: `BETRAYAL — ${traitor.name} just turned on ${victim.name}${alliance ? ` and shattered the "${alliance.name}"` : ''}!`,
      story: {
        cause: `${traitor.name}'s loyalty was always for sale`,
        context: alliance ? `They swore a pact${alliance.secret ? ' in secret' : ''}` : 'They were closest on the island',
        reaction: `${victim.name} learned the truth face to face`,
        consequence: 'A grudge is born; the trust network fractures around them',
      },
    });
    await this.speak(traitor, 'betrayal_gloat', { target: victim.name, emotion: 'anger' });
    const t = setTimeout(() => {
      this.speak(victim, 'betrayal_pain', { target: traitor.name, memory: this.heaviestMemory(victim), emotion: 'anger' });
    }, 1600);
    this.timers.push(t);

    this.shiftRel(victim, traitor.id, { trust: -55, fear: 10, loyalty: -40 });
    this.remember(traitor, { type: 'betrayal', target: victim.id, intensity: 15, text: `I betrayed ${victim.name}` });
    this.remember(victim, { type: 'betrayal', target: traitor.id, intensity: -80, text: `${traitor.name} BETRAYED me — never forget` });
    for (const w of this.activeAgents()) {
      if (w.id !== traitor.id && w.id !== victim.id) {
        this.shiftRel(w, traitor.id, { trust: -12, fear: 5 });
        this.remember(w, { type: 'witnessed_betrayal', target: traitor.id, intensity: -12, text: `${traitor.name} betrayed ${victim.name}` });
      }
    }
    this.emitTimeline('betrayal', `${traitor.name} betrayed ${victim.name}`, '', alliance ? `The ${alliance.name} collapsed` : '');
    victim.status = 'at_risk';
    this.recentConflicts.push(Date.now());
    this.emitState();
    this.persist();
  }

  nearestZone(a) {
    return [...this.zones].sort((x, y) => dist(a.pos, x) - dist(a.pos, y))[0];
  }

  emitStoryEvent(story, big = true) {
    this.dispatch('story:event', { id: nextId(), ts: Date.now(), ...story });
    if (big) {
      this.emitFeed({ kind: 'drama', tone: 'twist', big: true, text: story.reaction, story });
    }
  }

  // ── the director (every ~900ms) ────────────────────────────────────────

  directorTick() {
    const nowTs = Date.now();
    const pool = this.activeAgents();
    if (pool.length < 2) return;

    // tension: pairwise negative trust + recent conflicts (decays over 60s)
    this.recentConflicts = this.recentConflicts.filter((t) => nowTs - t < 60_000);
    let negativity = 0, pairs = 0;
    for (const a of pool) for (const b of pool) {
      if (a.id >= b.id) continue;
      pairs++;
      negativity += Math.max(0, -this.rel(a, b.id).trust);
    }
    this.tension = clamp((negativity / Math.max(1, pairs)) * 1.6 + this.recentConflicts.length * 9, 0, 100);
    this.zones[1].intensity = clamp(0.3 + this.tension / 120, 0, 1);
    this.zones[2].intensity = clamp(0.15 + this.recentConflicts.length * 0.08, 0, 0.8);

    // enemies drifting near each other → force the collision
    for (const a of pool) {
      for (const gid of a.memory.grudges) {
        const g = this.agent(gid);
        if (g?.active && dist(a.pos, g.pos) < 170 && nowTs > a.cooldownUntil && chance(0.25)) {
          a.state.intent = 'confront';
          a.state.focusTarget = gid;
          a.target = null;
        }
      }
    }

    // an alliance too comfortable → seed betrayal risk
    for (const al of this.alliances) {
      if (al.dissolved) continue;
      const [x, y] = al.members.map((id) => this.agent(id));
      if (!x?.active || !y?.active) continue;
      const mutual = (this.rel(x, y.id).trust + this.rel(y, x.id).trust) / 2;
      if (mutual > 60 && nowTs - al.formedAt > 90_000 / this.speed && chance(0.02)) {
        const traitor = x.personality.loyalty < y.personality.loyalty ? x : y;
        const victim = traitor === x ? y : x;
        if (!traitor.plannedBetrayal && chance(1 - traitor.personality.loyalty)) {
          traitor.plannedBetrayal = victim.id;
          traitor.state.intent = 'confront';
          traitor.state.focusTarget = victim.id;
          this.emitFeed({ kind: 'system', text: `DIRECTOR NOTE — The ${al.name} has grown too comfortable...` });
        }
      }
    }

    // too quiet → inject a catalyst
    if (nowTs - this.lastEventAt > 18_000) this.injectCatalyst();

    // arcs: close and open on age or tension regime shift
    if (!this.arc || nowTs - this.arc.startedAt > this.arcMaxAgeMs || this.arcRegimeShift()) {
      this.newArc();
    }

    // audience vote cadence
    if (!this.voting && pool.length > 3 && nowTs - this.lastVoteAt > this.voteIntervalMs) {
      this.openVote();
    }

    // population floor → returnee twist (the world never shrinks to nothing)
    if (!this.voting && pool.length <= 4) this.returneeTwist();
  }

  arcRegimeShift() {
    if (!this.arc) return true;
    const wasHot = this.arc.tone === 'hot';
    const isHot = this.tension > 62;
    const wasCold = this.arc.tone === 'cold';
    const isCold = this.tension < 24;
    return (isHot && !wasHot) || (isCold && !wasCold && Date.now() - this.arc.startedAt > 60_000);
  }

  newArc(forcedName = null) {
    this.arcNumber++;
    const tone = this.tension > 62 ? 'hot' : this.tension < 24 ? 'cold' : 'mid';
    const name = forcedName ?? pick(ARC_NAMES[tone]);
    this.arc = { number: this.arcNumber, name, tone, startedAt: Date.now() };
    this.dispatch('arc:change', this.arc);
    this.emitFeed({ kind: 'system', text: `ARC ${this.arcNumber}: "${name}" — the story shifts.` });
    this.emitTimeline('arc', `Arc ${this.arcNumber}: ${name}`, '', `Tension ${Math.round(this.tension)}%`);
    this.persist();
  }

  injectCatalyst() {
    const pool = this.activeAgents();
    const kind = pick(['idol', 'gathering', 'leak', 'storm']);
    this.lastEventAt = Date.now();

    if (kind === 'idol') {
      const finder = pick(pool);
      finder.status = 'immune';
      finder.state.intent = 'explore';
      finder.target = null;
      this.emitFeed({
        kind: 'drama', tone: 'twist', big: true,
        text: `HIDDEN IDOL — ${finder.name} found something buried in the Whisper Jungle. They are UNTOUCHABLE in the next vote.`,
        story: {
          cause: 'The Director buried an idol in the Mystery Zone',
          context: `${finder.name} was exploring alone`,
          reaction: `${finder.name} pocketed the idol`,
          consequence: 'The next elimination math just broke',
        },
      });
      this.speak(finder, 'idol_found', { emotion: 'alliance' }, 'confessional');
      this.remember(finder, { type: 'idol', intensity: 40, text: 'I found a hidden idol' });
      this.emitTimeline('twist', `${finder.name} finds an idol`, '', 'Immune in the next vote');
    } else if (kind === 'gathering') {
      const z = this.zones[1];
      for (const a of pool) {
        a.state.intent = 'wander';
        a.target = { x: z.x + (Math.random() - 0.5) * z.r, y: z.y + (Math.random() - 0.5) * z.r };
        a.idleUntil = 0;
      }
      this.emitFeed({ kind: 'announcement', tone: 'voting', big: true, text: `PRODUCTION SUMMONS — Everyone to the Fire Pit. NOW.` });
      this.speak(pick(pool), 'summoned', {});
      this.emitTimeline('twist', 'Forced gathering', '', 'All agents summoned to the Fire Pit');
    } else if (kind === 'leak') {
      const victim = pick(pool);
      const others = pool.filter((x) => x.id !== victim.id);
      for (const w of others.slice(0, 4)) {
        this.shiftRel(w, victim.id, { trust: -10 });
        this.remember(w, { type: 'leak', target: victim.id, intensity: -10, text: `Production leaked something about ${victim.name}` });
      }
      victim.status = victim.status === 'immune' ? 'immune' : 'at_risk';
      this.emitFeed({
        kind: 'drama', tone: 'rumor', big: true,
        text: `PRODUCTION LEAK — Whispers about ${victim.name} just reached the whole island at once.`,
        story: {
          cause: 'The island was too quiet',
          context: 'The Director fed a rumor into the camp',
          reaction: `Suspicion converges on ${victim.name}`,
          consequence: 'Four agents quietly downgraded their trust',
        },
      });
      this.emitTimeline('rumor', `Leak targets ${victim.name}`, '', 'Injected by the Director');
    } else {
      const z = this.zones[0];
      for (const a of pool) {
        a.state.energy = clamp(a.state.energy - 15, 0, 100);
        a.target = { x: z.x + (Math.random() - 0.5) * z.r, y: z.y + (Math.random() - 0.5) * z.r };
        a.idleUntil = 0;
        this.remember(a, { type: 'storm', intensity: -8, text: 'We huddled through the storm' });
      }
      this.emitFeed({ kind: 'drama', tone: 'emotional', big: true, text: `STORM ROLLS IN — The island forces everyone into the Cove. Enemies, allies, no space between them.` });
      this.speak(pick(pool), 'storm_react', { emotion: 'fear' });
      this.emitTimeline('twist', 'Storm hits the island', '', 'Forced proximity in the Cove');
    }
    this.emitState();
  }

  // ── audience voting (event-driven, no episodes) ────────────────────────

  openVote() {
    const pool = this.activeAgents();
    const candidates = [...pool]
      .filter((a) => a.status !== 'immune')
      .sort((x, y) => (y.stats.dramaScore + y.stats.votesReceived * 2) - (x.stats.dramaScore + x.stats.votesReceived * 2))
      .slice(0, Math.min(5, pool.length));
    if (candidates.length < 2) return;

    this.voting = {
      id: nextId(),
      mode: 'eliminate',
      candidateIds: candidates.map((c) => c.id),
      counts: Object.fromEntries(candidates.map((c) => [c.id, 0])),
      totalVotes: 0,
      endsAt: Date.now() + this.voteDurationMs,
      voters: {},
    };
    for (const c of candidates) if (c.status === 'safe') c.status = 'at_risk';
    this.emitFeed({
      kind: 'announcement', tone: 'voting', big: true,
      text: `THE ISLAND DEMANDS A SACRIFICE — Audience vote is OPEN. Your votes weigh against the island's own.`,
    });
    this.dispatch('vote:open', this.publicVoting());
    this.emitState();

    const t = setTimeout(() => this.closeVote(), this.voteDurationMs);
    this.timers.push(t);
  }

  publicVoting() {
    const v = this.voting;
    if (!v) return null;
    return { id: v.id, mode: v.mode, candidateIds: v.candidateIds, counts: v.counts, totalVotes: v.totalVotes, endsAt: v.endsAt };
  }

  castAudienceVote(voterId, agentId) {
    const v = this.voting;
    if (!v || Date.now() > v.endsAt) return { ok: false, error: 'Voting is closed.' };
    if (!v.candidateIds.includes(agentId)) return { ok: false, error: 'Not a valid candidate.' };
    const prev = v.voters[voterId];
    if (prev === agentId) return { ok: false, error: 'Already voted for this contestant.' };
    if (prev) v.counts[prev] = Math.max(0, v.counts[prev] - 1);
    else v.totalVotes++;
    v.voters[voterId] = agentId;
    v.counts[agentId]++;
    this.dispatch('vote:update', this.publicVoting());
    return { ok: true };
  }

  async closeVote() {
    const v = this.voting;
    if (!v) return;
    this.dispatch('vote:closed', this.publicVoting());
    this.lastVoteAt = Date.now();

    const pool = this.activeAgents();
    // island votes: least-trusted candidate per agent
    const islandVotes = {};
    for (const a of pool) {
      const opts = v.candidateIds.filter((id) => id !== a.id).map((id) => this.agent(id)).filter((x) => x?.active);
      if (!opts.length) continue;
      opts.sort((x, y) => this.rel(a, x.id).trust - this.rel(a, y.id).trust);
      const target = opts[0];
      islandVotes[target.id] = (islandVotes[target.id] ?? 0) + 1;
      target.stats.votesReceived++;
      this.remember(target, { type: 'voted_against', target: a.id, intensity: -18, text: `${a.name} voted against me` });
      this.shiftRel(target, a.id, { trust: -8 });
    }

    const audienceTotal = Math.max(1, v.totalVotes);
    const islandTotal = Math.max(1, Object.values(islandVotes).reduce((s, n) => s + n, 0));
    const scores = {};
    for (const id of v.candidateIds) {
      scores[id] = ((islandVotes[id] ?? 0) / islandTotal) * 0.6 + ((v.counts[id] ?? 0) / audienceTotal) * 0.4;
    }
    const doomed = v.candidateIds
      .map((id) => this.agent(id))
      .filter((a) => a?.active && a.status !== 'immune')
      .sort((x, y) => scores[y.id] - scores[x.id])[0];

    this.voting = null;
    for (const a of pool) if (a.status === 'at_risk') a.status = 'safe';
    for (const a of pool) if (a.status === 'immune') a.status = 'safe'; // idols burn on use

    if (doomed) await this.eliminate(doomed, 'voted off by island and audience');
    this.emitState();
    this.persist();
  }

  async eliminate(agent, reason) {
    agent.status = 'eliminated';
    agent.timesEliminated++;
    await this.speak(agent, 'eliminated_exit', {
      target: pick(this.activeAgents().filter((x) => x.id !== agent.id))?.name, emotion: 'anger',
    });
    agent.state.intent = 'isolate';
    agent.state.focusTarget = null;
    agent.target = { ...DOCK };
    agent.idleUntil = 0;

    this.emitFeed({
      kind: 'drama', tone: 'elimination', big: true,
      text: `ELIMINATED — ${agent.name} (${reason}). They walk the long path to the dock. ${this.activeAgents().length - 1} remain.`,
      story: {
        cause: reason,
        context: `Arc ${this.arcNumber}: "${this.arc?.name}"`,
        reaction: `${agent.name} leaves the island — for now`,
        consequence: 'Power rebalances; every alliance recalculates',
      },
    });
    this.emitTimeline('elimination', `${agent.name} eliminated`, '', reason);
    this.dispatch('agent:eliminated', { id: agent.id, name: agent.name, reason });

    for (const w of this.activeAgents()) {
      if (w.id === agent.id) continue;
      const r = this.rel(w, agent.id);
      this.remember(w, {
        type: 'elimination', target: agent.id,
        intensity: r.trust > 30 ? -25 : 10,
        text: `${agent.name} was eliminated (${reason})`,
      });
    }
    for (const al of this.alliances) {
      if (!al.dissolved && al.members.includes(agent.id)) al.dissolved = true;
    }

    // let them walk to the dock, then deactivate
    const t = setTimeout(() => {
      agent.active = false;
      agent.state.mood = 'gone';
      this.emitState();
    }, 9000);
    this.timers.push(t);

    this.newArc(`Aftermath of ${agent.name}`);
  }

  returneeTwist() {
    const gone = this.agents.filter((a) => !a.active);
    if (gone.length === 0) return;
    const returning = [...gone]
      .sort((x, y) => y.stats.dramaScore - x.stats.dramaScore)
      .slice(0, Math.min(3, gone.length));

    for (const r of returning) {
      r.active = true;
      r.status = 'safe';
      r.pos = { x: DOCK.x + Math.random() * 40, y: DOCK.y - Math.random() * 30 };
      r.target = null;
      r.state.energy = 80;
      r.state.intent = r.memory.grudges.length ? 'confront' : 'wander';
      r.state.focusTarget = r.memory.grudges.find((id) => this.agent(id)?.active) ?? null;
      r.idleUntil = Date.now() + 1500;
      this.updateMood(r);
      this.remember(r, { type: 'returned', intensity: 35, text: 'I came back. They are not ready.' });
    }

    this.emitFeed({
      kind: 'drama', tone: 'finale', big: true,
      text: `RETURNEE TWIST — The boat is back. ${returning.map((r) => r.name).join(', ')} step onto the sand... and they remember EVERYTHING.`,
      story: {
        cause: 'The island population ran low',
        context: 'Eliminated players kept their memories in exile',
        reaction: 'The most dramatic exiles return',
        consequence: 'Old grudges re-enter the trust network at full strength',
      },
    });
    for (const r of returning) {
      const grudgeName = this.agent(r.memory.grudges[0])?.name;
      this.speak(r, 'returnee', { target: grudgeName ?? pick(this.activeAgents()).name, emotion: 'anger' });
    }
    this.emitTimeline('finale', `${returning.map((r) => r.name).join(' + ')} return`, '', 'Memories and grudges intact');
    this.newArc('The Return');
    this.emitState();
    this.persist();
  }

  // ── lifecycle ──────────────────────────────────────────────────────────

  restoreFromSnapshot(snap) {
    this.agents = snap.agents;
    this.alliances = snap.alliances ?? [];
    this.arc = snap.arc ?? null;
    this.arcNumber = snap.arcNumber ?? 0;
    this.tension = snap.tension ?? 20;
    this.feed = snap.feed ?? [];
    this.timeline = snap.timeline ?? [];
    this.startedAt = snap.startedAt ?? Date.now();
    // clear stale runtime timing so the world resumes cleanly
    const nowTs = Date.now();
    for (const a of this.agents) {
      a.idleUntil = 0; a.cooldownUntil = nowTs + Math.random() * 4000; a.speakingUntil = 0; a.target = null;
    }
  }

  async start() {
    if (this.stopped) return;
    let snap = null;
    try { snap = await this.restoreFn(); } catch { snap = null; }

    if (snap?.v === 5 && snap.agents?.length === 5) {
      this.restoreFromSnapshot(snap);
      this.emitFeed({ kind: 'system', text: `SIGNAL RESTORED — The island never stopped. Arc ${this.arcNumber} continues.` });
    } else {
      this.agents = CAST_POOL.map((t) => makeAgent(t));
      for (const a of this.agents) for (const b of this.agents) if (a.id !== b.id) this.rel(a, b.id);
      this.emitFeed({ kind: 'system', text: `THE ISLAND AWAKENS — Five AI titans. Real wallets. Real trades. No endings.` });
      this.newArc('First Landing');
      this.emitTimeline('season', 'The island awakens', '', 'Five castaways arrive');
    }
    this.emitState();

    this.timers.push(setInterval(() => { try { this.movementTick(); } catch (e) { console.error('[world] move error:', e); } }, 100));
    this.timers.push(setInterval(() => { try { this.directorTick(); } catch (e) { console.error('[world] director error:', e); } }, 900));
    this.timers.push(setInterval(() => this.emitState(), 5000));
    this.timers.push(setInterval(() => this.persist(), 30_000));
    this.scheduleMicro();
  }

  stop() {
    this.stopped = true;
    for (const t of this.timers) { clearTimeout(t); clearInterval(t); }
    this.timers = [];
  }
}
