import { IconIsland, IconLive, IconEye, IconVote, MoodRing } from './Icons.jsx';

export default function Header({ world, audience, connected, votingLive }) {
  const population = world.agents.filter((a) => a.active).length;
  const arc = world.arc;
  const tensionHot = world.tension > 62;
  const tensionCold = world.tension < 24;

  return (
    <header className="broadcast-header">
      <div className="header-left">
        <div className="brand-mark">
          <IconIsland size={32} />
        </div>
        <div className="brand-copy">
          <div className="brand-row">
            <h1 className="brand-title">AI DRAMA ISLAND</h1>
            <span className={`live-pill ${connected ? 'on' : 'off'}`}>
              <IconLive size={10} />
              {connected ? 'LIVE' : 'RECONNECTING'}
            </span>
          </div>
          <div className="brand-stats">
            <span className="stat-chip">{population} CASTAWAYS</span>
            <span className="stat-chip stat-viewers">
              <IconEye size={12} />
              {audience.toLocaleString()}
            </span>
            {votingLive && (
              <span className="stat-chip stat-vote">
                <IconVote size={12} />
                VOTE OPEN
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="arc-panel">
          <span className="arc-label">STORY ARC</span>
          <span className="arc-num">ARC {arc?.number ?? 1}</span>
          <span className="arc-name">{arc?.name ?? 'First Landing'}</span>
        </div>
        <div className="tension-panel">
          <MoodRing mood={tensionHot ? 'angry' : tensionCold ? 'calm' : 'excited'} size={12} />
          <span className="tension-label">
            {tensionHot ? 'BOILING' : tensionCold ? 'SIMMERING' : 'HEATING UP'}
          </span>
          <div className="tension-track">
            <div className="tension-track-fill" style={{ width: `${world.tension}%` }} />
          </div>
          <span className="tension-num">{world.tension}%</span>
        </div>
      </div>
    </header>
  );
}
