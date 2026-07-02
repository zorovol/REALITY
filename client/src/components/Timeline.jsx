import { useEffect, useRef, useState } from 'react';

export default function Timeline({ items, arc }) {
  const scrollRef = useRef(null);
  const [focused, setFocused] = useState(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [items.length]);

  return (
    <footer className="timeline glass">
      <div className="timeline-head">
        <span className="timeline-title">📼 STORY TIMELINE</span>
        <span className="timeline-season">Arc {arc?.number ?? 1} — “{arc?.name ?? 'First Landing'}”</span>
      </div>
      <div className="timeline-scroll" ref={scrollRef}>
        <div className="timeline-track">
          {items.map((item) => (
            <button
              key={item.id}
              className={`timeline-node type-${item.type} ${focused === item.id ? 'focused' : ''}`}
              onClick={() => setFocused(focused === item.id ? null : item.id)}
              title={`${item.label}${item.detail ? ` — ${item.detail}` : ''}`}
            >
              <span className="node-icon">{item.icon}</span>
              <span className="node-ep">A{item.arc ?? item.episode ?? 1}</span>
              <span className="node-label">{item.label}</span>
              {focused === item.id && item.detail && (
                <span className="node-detail">{item.detail}</span>
              )}
            </button>
          ))}
          {items.length === 0 && <div className="timeline-empty">History will be written here…</div>}
        </div>
      </div>
    </footer>
  );
}
