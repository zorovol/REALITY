import { useEffect, useRef, useState } from 'react';
import Character from './Character.jsx';
import { IconArc, IconConfessional, IconCaretDown } from './Icons.jsx';
import { stripEmoji } from '../utils/textUtils.js';

function FeedItem({ item }) {
  const text = stripEmoji(item.text);

  if (item.kind === 'system') {
    return (
      <div className="feed-system">
        <span className="feed-system-line" />
        <span className="feed-system-text">{text}</span>
        <span className="feed-system-line" />
      </div>
    );
  }

  if (item.kind === 'announcement' || item.kind === 'drama') {
    return (
      <div className={`feed-event tone-${item.tone ?? 'default'} ${item.big ? 'feed-event-major' : ''}`}>
        <div className="feed-event-glow" aria-hidden="true" />
        <p className="feed-event-text">{text}</p>
        {item.story && (
          <div className="feed-story">
            <div className="feed-story-row"><span className="feed-story-key">CAUSE</span>{stripEmoji(item.story.cause)}</div>
            <div className="feed-story-row"><span className="feed-story-key">CONTEXT</span>{stripEmoji(item.story.context)}</div>
            <div className="feed-story-row"><span className="feed-story-key">CONSEQUENCE</span>{stripEmoji(item.story.consequence)}</div>
          </div>
        )}
      </div>
    );
  }

  const confessional = item.kind === 'confessional';
  return (
    <div className={`feed-line ${confessional ? 'feed-line-confessional' : ''}`}>
      <div className="feed-line-avatar">
        <Character id={item.speakerId} size={36} />
      </div>
      <div className="feed-line-body">
        <div className="feed-line-meta">
          <span className="feed-line-name">{item.speakerName}</span>
          {confessional && (
            <span className="feed-confessional-tag">
              <IconConfessional size={10} />
              CONFESSIONAL
            </span>
          )}
          {item.targetName && !confessional && (
            <span className="feed-line-target">→ {item.targetName}</span>
          )}
        </div>
        <p className="feed-line-text">{text}</p>
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

  const tone = arc?.tone ?? 'mid';

  return (
    <section className="feed-panel">
      <header className={`feed-head feed-head-${tone}`}>
        <IconArc size={14} />
        <span className="feed-head-text">
          ARC {arc?.number ?? 1} — {arc?.name ?? 'First Landing'}
        </span>
        <span className="feed-head-pulse" aria-hidden="true" />
      </header>
      <div className="feed-scroll" ref={scrollRef} onScroll={onScroll}>
        {feed.map((item) => <FeedItem key={item.id} item={item} />)}
      </div>
      {!pinned && (
        <button
          className="feed-jump"
          onClick={() => {
            setPinned(true);
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
          }}
        >
          <IconCaretDown size={12} />
          JUMP TO LIVE
        </button>
      )}
    </section>
  );
}
