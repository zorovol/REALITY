import { useEffect, useRef } from 'react';
import { on } from '../showSource.js';
import Character from './Character.jsx';
import { MoodRing, IconDock } from './Icons.jsx';
import { stripEmoji } from '../utils/textUtils.js';

const WORLD = { w: 1000, h: 600 };
const TYPE_MS = 28;
const LINGER_MS = 2600;

const INTENT_LABEL = {
  wander: 'Wandering',
  seek_alliance: 'Seeking allies',
  confront: 'On the hunt',
  explore: 'Exploring',
  isolate: 'Withdrawing',
};

export default function MapStage({ agents, zones, tension }) {
  const stageRef = useRef(null);
  const posRef = useRef(new Map());
  const speechRef = useRef(new Map());
  const nodeRef = useRef(new Map());

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
        text: stripEmoji(s.text),
        emotion: s.emotion ?? 'neutral',
        startedAt: performance.now(),
        durationMs: s.durationMs ?? s.text.length * TYPE_MS + LINGER_MS,
      });
    });
    return () => { offPos(); offSpeak(); };
  }, []);

  useEffect(() => {
    let raf;
    const frame = () => {
      const now = performance.now();
      for (const [id, refs] of nodeRef.current) {
        const p = posRef.current.get(id);
        if (p && refs.root) {
          p.x += (p.tx - p.x) * 0.11;
          p.y += (p.ty - p.y) * 0.11;
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
              refs.bubbleText.textContent = s.text.slice(0, chars);
              if (!done) refs.cursor?.classList.add('blink');
              else refs.cursor?.classList.remove('blink');
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
        cursor: el.querySelector('.speech-cursor'),
      });
    } else {
      nodeRef.current.delete(id);
    }
  };

  const activeAgents = agents.filter((a) => a.active);

  return (
    <section className="stage-panel">
      <div className="stage-toolbar">
        <span className="stage-label">LIVE STAGE</span>
        <div className="stage-tension">
          <span className="stage-tension-label">TENSION</span>
          <div className="stage-tension-bar">
            <div className="stage-tension-fill" style={{ width: `${tension}%` }} />
          </div>
          <span className="stage-tension-val">{tension}%</span>
        </div>
      </div>

      <div className="stage-canvas" ref={stageRef}>
        <div className="terrain-ocean" aria-hidden="true" />
        <div className="terrain-island" aria-hidden="true" />
        <div className="terrain-grid" aria-hidden="true" />

        {zones?.map((z) => (
          <div
            key={z.id}
            className={`zone zone-${z.type}`}
            style={{
              left: `${(z.x / WORLD.w) * 100}%`,
              top: `${(z.y / WORLD.h) * 100}%`,
              width: `${(z.r * 2 / WORLD.w) * 100}%`,
              height: `${(z.r * 2 / WORLD.h) * 100}%`,
              '--zone-i': z.intensity ?? 0.3,
            }}
          >
            <span className="zone-name">{z.name}</span>
            <span className="zone-ring" />
          </div>
        ))}

        <div className="stage-dock" style={{ left: '5%', top: '88%' }} title="The Dock">
          <IconDock size={22} />
          <span>DOCK</span>
        </div>

        {activeAgents.map((a) => (
          <div
            key={a.id}
            ref={bindNode(a.id)}
            className={`stage-agent mood-${a.mood} ${a.status === 'at_risk' ? 'at-risk' : ''} ${a.status === 'immune' ? 'immune' : ''}`}
            style={{
              left: `${((a.pos?.x ?? 500) / WORLD.w) * 100}%`,
              top: `${((a.pos?.y ?? 300) / WORLD.h) * 100}%`,
              '--accent': a.color,
            }}
            title={`${a.name} — ${a.mood}`}
          >
            <div className="speech-bubble">
              <span className="speech-text" />
              <span className="speech-cursor blink" />
            </div>
            <div className="agent-figure">
              <Character id={a.id} size={46} mood={a.mood} />
              <MoodRing mood={a.mood} size={8} className="agent-mood-ring" />
            </div>
            <div className="agent-plate">
              <span className="agent-plate-name">{a.name}</span>
              <span className="agent-plate-intent">{INTENT_LABEL[a.intent] ?? a.intent}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
