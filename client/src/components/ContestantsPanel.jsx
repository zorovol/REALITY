import Avatar from './Avatar.jsx';

const MOOD_META = {
  angry: { emoji: '😡', label: 'Angry' },
  calm: { emoji: '😌', label: 'Calm' },
  paranoid: { emoji: '🫣', label: 'Paranoid' },
  excited: { emoji: '🤩', label: 'Excited' },
  sad: { emoji: '😢', label: 'Sad' },
  gone: { emoji: '👻', label: 'Off-island' },
};

const STATUS_META = {
  safe: { label: 'SAFE', cls: 'safe' },
  at_risk: { label: 'AT RISK', cls: 'risk' },
  immune: { label: 'IMMUNE', cls: 'immune' },
  eliminated: { label: 'EXILED', cls: 'out' },
};

const INTENT_META = {
  wander: '🚶 wandering',
  seek_alliance: '🤝 seeking allies',
  confront: '⚔️ on the hunt',
  explore: '🧭 exploring',
  isolate: '🌑 withdrawing',
};

export default function ContestantsPanel({ agents, eliminatedFlash, agentById }) {
  const sorted = [...agents].sort((a, b) => Number(!a.active) - Number(!b.active));

  return (
    <aside className="panel glass contestants-panel">
      <h2 className="panel-title">
        <span>CAST</span>
        <span className="panel-title-sub">{agents.filter((a) => a.active).length}/{agents.length}</span>
      </h2>
      <div className="contestant-list">
        {sorted.map((c) => {
          const mood = MOOD_META[c.mood] ?? MOOD_META.calm;
          const status = STATUS_META[c.active ? c.status : 'eliminated'] ?? STATUS_META.safe;
          const flashing = eliminatedFlash?.id === c.id;
          const focus = c.focusTarget ? agentById?.(c.focusTarget) : null;
          return (
            <div
              key={c.id}
              className={`contestant-card ${!c.active ? 'eliminated' : ''} ${flashing ? 'elim-flash' : ''}`}
              style={{ '--accent': c.color }}
            >
              <div className="avatar-ring">
                <Avatar id={c.id} size={40} />
                <span className="mood-bubble" title={mood.label}>{mood.emoji}</span>
              </div>
              <div className="contestant-info">
                <div className="contestant-name-row">
                  <span className="contestant-name">{c.name}</span>
                  {c.allies?.length > 0 && (
                    <span className="alliance-badges" title={`Allied with ${c.allies.map((id) => agentById?.(id)?.name ?? id).join(', ')}`}>
                      🤝{c.allies.length > 1 ? `×${c.allies.length}` : ''}
                    </span>
                  )}
                  {c.grudges?.length > 0 && (
                    <span className="grudge-badge" title={`Grudges: ${c.grudges.map((id) => agentById?.(id)?.name ?? id).join(', ')}`}>
                      🗡️{c.grudges.length > 1 ? `×${c.grudges.length}` : ''}
                    </span>
                  )}
                </div>
                <div className="contestant-model">{c.modelLabel}</div>
                {c.active ? (
                  <div className="contestant-live-state">
                    <span className="intent-chip">
                      {INTENT_META[c.intent] ?? c.intent}{focus ? ` → ${focus.name}` : ''}
                    </span>
                    <span className="energy-bar" title={`Energy ${c.energy}/100`}>
                      <span className="energy-fill" style={{ width: `${c.energy}%` }} />
                    </span>
                  </div>
                ) : (
                  <div className="contestant-tagline">{c.tagline}</div>
                )}
              </div>
              <div className={`status-tag ${status.cls}`}>
                {status.label}{c.timesEliminated > 0 && c.active ? ' ↩' : ''}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
