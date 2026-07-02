import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';

function FeedItem({ item }) {
  if (item.kind === 'system') {
    return <div className="feed-system fade-in">{item.text}</div>;
  }
  if (item.kind === 'announcement' || item.kind === 'drama') {
    return (
      <div className={`feed-drama fade-in tone-${item.tone ?? 'default'} ${item.big ? 'big' : ''}`}>
        <div className="drama-glow" aria-hidden="true" />
        <p>{item.text}</p>
        {item.story && (
          <div className="story-chain">
            <span><b>CAUSE</b> {item.story.cause}</span>
            <span><b>CONTEXT</b> {item.story.context}</span>
            <span><b>CONSEQUENCE</b> {item.story.consequence}</span>
          </div>
        )}
      </div>
    );
  }
  const confessional = item.kind === 'confessional';
  return (
    <div className={`feed-msg fade-in ${confessional ? 'confessional' : ''}`} style={{ '--accent': item.color }}>
      <span className="feed-avatar"><Avatar id={item.speakerId} size={30} /></span>
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

export default function DramaFeed({ feed, arc }) {
  const scrollRef = useRef(null);
  const [pinned, setPinned] = useState(true);

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
      <div className={`phase-banner banner-arc-${arc?.tone ?? 'mid'}`}>
        <span className="banner-icon">📖</span>
        <span className="banner-text">ARC {arc?.number ?? 1} — “{arc?.name ?? 'First Landing'}”</span>
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
