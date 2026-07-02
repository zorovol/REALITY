export default function Header({ world, audience, connected, votingLive }) {
  const population = world.agents.filter((a) => a.active).length;
  const arc = world.arc;

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
            <span className="meta-chip">{population} on the island</span>
            <span className="meta-chip viewers">👁 {audience} watching</span>
            {votingLive && <span className="meta-chip vote-live">🗳️ VOTE OPEN</span>}
          </div>
        </div>
      </div>

      <div className="arc-display">
        <div className="arc-badge">
          <span className="arc-number">ARC {arc?.number ?? 1}</span>
          <span className="arc-name">“{arc?.name ?? 'First Landing'}”</span>
        </div>
        <div className="arc-tension" title="Island-wide drama tension">
          <span className={`tension-dot ${world.tension > 62 ? 'hot' : world.tension < 24 ? 'cold' : ''}`} />
          <span className="arc-tension-text">
            {world.tension > 62 ? 'BOILING' : world.tension < 24 ? 'SIMMERING' : 'HEATING UP'}
          </span>
        </div>
      </div>
    </header>
  );
}
