import { useEffect, useRef, useState } from 'react';

const PHASE_BANNERS = {
  interaction: { icon: '💬', text: 'INTERACTION PHASE — The island is talking' },
  drama: { icon: '💥', text: 'DRAMA PHASE — Something is about to break' },
  reaction: { icon: '😱', text: 'REACTION PHASE — The fallout begins' },
  voting: { icon: '🗳️', text: 'VOTING PHASE — The audience decides' },
  outcome: { icon: '⚖️', text: 'OUTCOME PHASE — The island delivers its verdict' },
  intermission: { icon: '🎬', text: 'INTERMISSION — Next episode loading' },
};

function FeedItem({ item }) {
  if (item.kind === 'system') {
    return <div className="feed-system fade-in">{item.text}</div>;
  }
  if (item.kind === 'announcement' || item.kind === 'drama') {
    return (
      <div className={`feed-drama fade-in tone-${item.tone ?? 'default'} ${item.big ? 'big' : ''}`}>
        <div className="drama-glow" aria-hidden="true" />
        <p>{item.text}</p>
      </div>
    );
  }
  const confessional = item.kind === 'confessional';
  return (
    <div className={`feed-msg fade-in ${confessional ? 'confessional' : ''}`} style={{ '--accent': item.color }}>
      <span className="feed-avatar">{item.avatar}</span>
      <div className="feed-body">
        <div className="feed-meta">
          <span className="feed-name">{item.speakerName}</span>
          {confessional && <span className="confessional-tag">🎥 CONFESSIONAL</span>}
          {item.targetName && !confessional && <span className="feed-target">→ {item.targetName}</span>}
        </div>
        <p className="feed-text">{item.text}</p>
      </div>
    </div>
  );
}

export default function DramaFeed({ feed, phase }) {
  const scrollRef = useRef(null);
  const [pinned, setPinned] = useState(true);
  const banner = PHASE_BANNERS[phase] ?? PHASE_BANNERS.interaction;

  useEffect(() => {
    if (pinned && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [feed, pinned]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  return (
    <section className="panel glass feed-panel">
      <div className={`phase-banner banner-${phase}`}>
        <span className="banner-icon">{banner.icon}</span>
        <span className="banner-text">{banner.text}</span>
        <span className="banner-pulse" aria-hidden="true" />
      </div>
      <div className="feed-scroll" ref={scrollRef} onScroll={onScroll}>
        {feed.map((item) => <FeedItem key={item.id} item={item} />)}
      </div>
      {!pinned && (
        <button
          className="jump-live"
          onClick={() => {
            setPinned(true);
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
          }}
        >
          ▼ JUMP TO LIVE
        </button>
      )}
    </section>
  );
}
