import { useEffect, useRef } from 'react';
import { on } from '../showSource.js';
import Avatar from './Avatar.jsx';

/**
 * MapStage — the living island.
 * React renders the static structure (zones, agent nodes); a single
 * requestAnimationFrame loop drives everything dynamic at 60fps by mutating
 * the DOM directly: smooth position interpolation between 10 Hz server
 * updates, letter-by-letter speech typing above each head, and fades.
 */

const WORLD = { w: 1000, h: 600 };
const TYPE_MS = 30; // ms per character
const LINGER_MS = 2400; // hold after typing completes

const MOOD_EMOJI = {
  angry: '😡', calm: '😌', paranoid: '🫣', excited: '🤩', sad: '😢', gone: '👻',
};
const INTENT_LABEL = {
  wander: 'wandering', seek_alliance: 'seeking allies', confront: 'on the hunt',
  explore: 'exploring', isolate: 'withdrawing',
};

export default function MapStage({ agents, zones, tension }) {
  const stageRef = useRef(null);
  const posRef = useRef(new Map());    // id -> { x, y, tx, ty }
  const speechRef = useRef(new Map()); // id -> { text, emotion, startedAt, durationMs }
  const nodeRef = useRef(new Map());   // id -> { root, bubble, bubbleText }

  // seed / update interpolation targets from full state
  useEffect(() => {
    for (const a of agents) {
      if (!a.pos) continue;
      const cur = posRef.current.get(a.id);
      if (cur) { cur.tx = a.pos.x; cur.ty = a.pos.y; }
      else posRef.current.set(a.id, { x: a.pos.x, y: a.pos.y, tx: a.pos.x, ty: a.pos.y });
    }
  }, [agents]);

  useEffect(() => {
    const offPos = on('world:positions', ({ p }) => {
      for (const [id, x, y] of p) {
        const cur = posRef.current.get(id);
        if (cur) { cur.tx = x; cur.ty = y; }
        else posRef.current.set(id, { x, y, tx: x, ty: y });
      }
    });
    const offSpeak = on('agent:speak', (s) => {
      speechRef.current.set(s.agentId, {
        text: s.text,
        emotion: s.emotion ?? 'neutral',
        startedAt: performance.now(),
        durationMs: s.durationMs ?? s.text.length * TYPE_MS + LINGER_MS,
      });
    });
    return () => { offPos(); offSpeak(); };
  }, []);

  // the 60fps render loop
  useEffect(() => {
    let raf;
    const frame = () => {
      const now = performance.now();
      for (const [id, refs] of nodeRef.current) {
        const p = posRef.current.get(id);
        if (p && refs.root) {
          p.x += (p.tx - p.x) * 0.12;
          p.y += (p.ty - p.y) * 0.12;
          refs.root.style.left = `${(p.x / WORLD.w) * 100}%`;
          refs.root.style.top = `${(p.y / WORLD.h) * 100}%`;
        }
        const s = speechRef.current.get(id);
        if (refs.bubble) {
          if (s) {
            const elapsed = now - s.startedAt;
            const chars = Math.floor(elapsed / TYPE_MS);
            const done = chars >= s.text.length;
            const expired = elapsed > s.text.length * TYPE_MS + LINGER_MS;
            if (expired) {
              speechRef.current.delete(id);
              refs.bubble.classList.remove('visible');
            } else {
              refs.bubbleText.textContent = s.text.slice(0, chars) + (done ? '' : '▌');
              refs.bubble.className = `speech-bubble visible emo-${s.emotion}`;
            }
          } else if (refs.bubble.classList.contains('visible')) {
            refs.bubble.classList.remove('visible');
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bindNode = (id) => (el) => {
    if (el) {
      nodeRef.current.set(id, {
        root: el,
        bubble: el.querySelector('.speech-bubble'),
        bubbleText: el.querySelector('.speech-text'),
      });
    } else {
      nodeRef.current.delete(id);
    }
  };

  const activeAgents = agents.filter((a) => a.active);

  return (
    <section className="panel glass map-panel">
      <div className="map-head">
        <span className="map-title">🌴 THE ISLAND — LIVE STAGE</span>
        <span className="tension-meter" title="Drama tension">
          <span className="tension-label">TENSION</span>
          <span className="tension-bar"><span className="tension-fill" style={{ width: `${tension}%` }} /></span>
          <span className="tension-value">{tension}%</span>
        </span>
      </div>
      <div className="map-stage" ref={stageRef}>
        <div className="map-water" aria-hidden="true" />
        <div className="map-island" aria-hidden="true" />
        {zones?.map((z) => (
          <div
            key={z.id}
            className={`map-zone zone-${z.type}`}
            style={{
              left: `${(z.x / WORLD.w) * 100}%`,
              top: `${(z.y / WORLD.h) * 100}%`,
              width: `${(z.r * 2 / WORLD.w) * 100}%`,
              height: `${(z.r * 2 / WORLD.h) * 100}%`,
              '--intensity': z.intensity ?? 0.3,
            }}
          >
            <span className="zone-label">{z.name}</span>
          </div>
        ))}
        <div className="map-dock" style={{ left: '6%', top: '90%' }} title="The Dock">⛵</div>

        {activeAgents.map((a) => (
          <div
            key={a.id}
            ref={bindNode(a.id)}
            className={`map-agent mood-${a.mood} ${a.status === 'at_risk' ? 'at-risk' : ''} ${a.status === 'immune' ? 'immune' : ''}`}
            style={{
              left: `${((a.pos?.x ?? 500) / WORLD.w) * 100}%`,
              top: `${((a.pos?.y ?? 300) / WORLD.h) * 100}%`,
              '--accent': a.color,
            }}
            title={`${a.name} — ${a.mood}, ${INTENT_LABEL[a.intent] ?? a.intent}`}
          >
            <div className="speech-bubble"><span className="speech-text" /></div>
            <div className="agent-body">
              <Avatar id={a.id} size={34} />
              <span className="agent-mood">{MOOD_EMOJI[a.mood] ?? '😐'}</span>
            </div>
            <div className="agent-nameplate">
              <span className="agent-name">{a.name}</span>
              <span className="agent-intent">{INTENT_LABEL[a.intent] ?? a.intent}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
