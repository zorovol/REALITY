import { useEffect, useRef, useState } from 'react';
import { TimelineIcon, IconTimeline } from './Icons.jsx';

export default function Timeline({ items, arc }) {
  const scrollRef = useRef(null);
  const [focused, setFocused] = useState(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [items.length]);

  return (
    <footer className="timeline-bar">
      <header className="timeline-head">
        <span className="timeline-title">
          <IconTimeline size={14} />
          STORY TIMELINE
        </span>
        <span className="timeline-arc">
          Arc {arc?.number ?? 1} — {arc?.name ?? 'First Landing'}
        </span>
      </header>
      <div className="timeline-track-wrap" ref={scrollRef}>
        <div className="timeline-track">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`timeline-node type-${item.type} ${focused === item.id ? 'focused' : ''}`}
              onClick={() => setFocused(focused === item.id ? null : item.id)}
              title={item.detail ? `${item.label} — ${item.detail}` : item.label}
            >
              <span className="timeline-node-icon">
                <TimelineIcon type={item.type} size={16} />
              </span>
              <span className="timeline-node-arc">A{item.arc ?? 1}</span>
              <span className="timeline-node-label">{item.label}</span>
              {focused === item.id && item.detail && (
                <span className="timeline-node-tip">{item.detail}</span>
              )}
            </button>
          ))}
          {items.length === 0 && <span className="timeline-empty">History will be written here…</span>}
        </div>
      </div>
    </footer>
  );
}
