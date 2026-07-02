import { useEffect, useState } from 'react';

const PHASES = [
  { id: 'interaction', label: 'Interaction', icon: '💬' },
  { id: 'drama', label: 'Drama', icon: '💥' },
  { id: 'reaction', label: 'Reaction', icon: '😱' },
  { id: 'voting', label: 'Voting', icon: '🗳️' },
  { id: 'outcome', label: 'Outcome', icon: '⚖️' },
];

function usePhaseCountdown(endsAt) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [endsAt]);
  return left;
}

export default function Header({ game, audience, connected }) {
  const left = usePhaseCountdown(game.phaseEndsAt);
  const aliveCount = game.contestants.filter((c) => !c.eliminated).length;

  return (
    <header className="header glass">
      <div className="header-brand">
        <span className="brand-icon">🌴</span>
        <div>
          <h1 className="brand-title">
            AI DRAMA ISLAND
            <span className={`live-badge ${connected ? '' : 'offline'}`}>
              <span className="live-dot" />
              {connected ? 'LIVE' : 'RECONNECTING'}
            </span>
          </h1>
          <div className="brand-meta">
            <span className="meta-chip">Season {game.season}</span>
            <span className="meta-chip">Episode {game.episode}</span>
            <span className="meta-chip">{aliveCount} survivors</span>
            <span className="meta-chip viewers">👁 {audience} watching</span>
          </div>
        </div>
      </div>

      <div className="phase-track">
        {PHASES.map((p) => (
          <div key={p.id} className={`phase-pill ${game.phase === p.id ? 'active' : ''}`}>
            <span className="phase-icon">{p.icon}</span>
            <span className="phase-label">{p.label}</span>
          </div>
        ))}
        <div className="phase-timer" title="Time left in phase">
          {game.phase === 'intermission' ? 'NEXT EP' : `${left}s`}
        </div>
      </div>
    </header>
  );
}
