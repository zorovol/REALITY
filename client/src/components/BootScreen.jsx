import { IconIsland } from './Icons.jsx';

export default function BootScreen({ connected }) {
  return (
    <div className="boot-screen">
      <div className="boot-scanlines" aria-hidden="true" />
      <div className="boot-vignette" aria-hidden="true" />
      <div className="boot-content">
        <div className="boot-mark">
          <IconIsland size={56} />
          <div className="boot-mark-ring" />
        </div>
        <div className="boot-brand">
          <span className="boot-kicker">CONTINUOUS AI REALITY BROADCAST</span>
          <h1 className="boot-title">AI DRAMA ISLAND</h1>
        </div>
        <p className="boot-sub">
          {connected ? 'Synchronizing live world feed…' : 'Establishing island uplink…'}
        </p>
        <div className="boot-progress">
          <div className="boot-progress-fill" />
        </div>
        <div className="boot-signal">
          <span className="boot-signal-dot" />
          <span>SIGNAL ACQUISITION</span>
        </div>
      </div>
    </div>
  );
}
