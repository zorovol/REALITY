const MOOD_META = {
  happy: { emoji: '😄', label: 'Happy' },
  confident: { emoji: '😎', label: 'Confident' },
  scheming: { emoji: '😏', label: 'Scheming' },
  neutral: { emoji: '😐', label: 'Neutral' },
  anxious: { emoji: '😰', label: 'Anxious' },
  angry: { emoji: '😡', label: 'Angry' },
  devastated: { emoji: '😭', label: 'Devastated' },
  gone: { emoji: '👻', label: 'Gone' },
};

const STATUS_META = {
  safe: { label: 'SAFE', cls: 'safe' },
  at_risk: { label: 'AT RISK', cls: 'risk' },
  immune: { label: 'IMMUNE', cls: 'immune' },
  eliminated: { label: 'ELIMINATED', cls: 'out' },
};

export default function ContestantsPanel({ contestants, eliminatedFlash }) {
  const sorted = [...contestants].sort((a, b) => Number(a.eliminated) - Number(b.eliminated));

  return (
    <aside className="panel glass contestants-panel">
      <h2 className="panel-title">
        <span>CAST</span>
        <span className="panel-title-sub">{contestants.filter((c) => !c.eliminated).length}/{contestants.length}</span>
      </h2>
      <div className="contestant-list">
        {sorted.map((c) => {
          const mood = MOOD_META[c.mood] ?? MOOD_META.neutral;
          const status = STATUS_META[c.status] ?? STATUS_META.safe;
          const flashing = eliminatedFlash?.id === c.id;
          return (
            <div
              key={c.id}
              className={`contestant-card ${c.eliminated ? 'eliminated' : ''} ${flashing ? 'elim-flash' : ''}`}
              style={{ '--accent': c.color }}
            >
              <div className="avatar-ring">
                <span className="avatar">{c.avatar}</span>
                <span className="mood-bubble" title={mood.label}>{mood.emoji}</span>
              </div>
              <div className="contestant-info">
                <div className="contestant-name-row">
                  <span className="contestant-name">{c.name}</span>
                  {c.alliances?.length > 0 && (
                    <span className="alliance-badges" title={`${c.alliances.length} active alliance(s)`}>
                      {c.alliances.map((id) => <span key={id} className="alliance-dot">🤝</span>)}
                    </span>
                  )}
                </div>
                <div className="contestant-model">{c.modelLabel}</div>
                <div className="contestant-tagline">{c.tagline}</div>
              </div>
              <div className={`status-tag ${status.cls}`}>
                {c.eliminated && c.placement ? `#${c.placement}` : status.label}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
