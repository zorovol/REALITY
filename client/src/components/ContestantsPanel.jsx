import Character from './Character.jsx';
import { MoodRing, IconAlliance, IconGrudge } from './Icons.jsx';

const MOOD_LABEL = {
  angry: 'Angry', calm: 'Calm', paranoid: 'Paranoid', excited: 'Excited', sad: 'Sad', gone: 'Exiled',
};

const STATUS_META = {
  safe: { label: 'SAFE', cls: 'safe' },
  at_risk: { label: 'AT RISK', cls: 'risk' },
  immune: { label: 'IMMUNE', cls: 'immune' },
  eliminated: { label: 'EXILED', cls: 'out' },
};

const INTENT_LABEL = {
  wander: 'Wandering',
  seek_alliance: 'Seeking allies',
  confront: 'On the hunt',
  explore: 'Exploring',
  isolate: 'Withdrawing',
};

export default function ContestantsPanel({ agents, eliminatedFlash, agentById }) {
  const sorted = [...agents].sort((a, b) => Number(!a.active) - Number(!b.active));
  const activeCount = agents.filter((a) => a.active).length;

  return (
    <aside className="cast-panel">
      <header className="panel-head">
        <span className="panel-head-title">CAST</span>
        <span className="panel-head-count">{activeCount}<span className="panel-head-sep">/</span>{agents.length}</span>
      </header>
      <div className="cast-list">
        {sorted.map((c) => {
          const status = STATUS_META[c.active ? c.status : 'eliminated'] ?? STATUS_META.safe;
          const flashing = eliminatedFlash?.id === c.id;
          const focus = c.focusTarget ? agentById?.(c.focusTarget) : null;
          return (
            <article
              key={c.id}
              className={`cast-card ${!c.active ? 'exiled' : ''} ${flashing ? 'elim-flash' : ''}`}
              style={{ '--accent': c.color }}
            >
              <div className="cast-portrait">
                <Character id={c.id} size={52} mood={c.mood} />
                <MoodRing mood={c.mood} size={9} className="cast-mood" title={MOOD_LABEL[c.mood]} />
              </div>
              <div className="cast-body">
                <div className="cast-name-row">
                  <h3 className="cast-name">{c.name}</h3>
                  {c.allies?.length > 0 && (
                    <span className="cast-badge cast-badge-ally" title={`Allied: ${c.allies.map((id) => agentById?.(id)?.name ?? id).join(', ')}`}>
                      <IconAlliance size={11} />
                      {c.allies.length}
                    </span>
                  )}
                  {c.grudges?.length > 0 && (
                    <span className="cast-badge cast-badge-grudge" title={`Grudges: ${c.grudges.map((id) => agentById?.(id)?.name ?? id).join(', ')}`}>
                      <IconGrudge size={11} />
                      {c.grudges.length}
                    </span>
                  )}
                </div>
                <p className="cast-model">{c.modelLabel}</p>
                {c.active ? (
                  <div className="cast-live">
                    <span className="cast-intent">
                      {INTENT_LABEL[c.intent] ?? c.intent}
                      {focus ? <span className="cast-focus"> → {focus.name}</span> : null}
                    </span>
                    <div className="cast-energy" title={`Energy ${c.energy}/100`}>
                      <div className="cast-energy-fill" style={{ width: `${c.energy}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="cast-tagline">{c.tagline}</p>
                )}
              </div>
              <span className={`cast-status ${status.cls}`}>
                {status.label}{c.timesEliminated > 0 && c.active ? ' · RETURN' : ''}
              </span>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
