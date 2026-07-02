import { IconMarket } from './Icons.jsx';

export default function BootScreen({ connected, mode, reason, error }) {
  let sub = 'Connecting to trading server…';
  if (error) sub = `Boot error — ${error}`;
  else if (mode === 'local') sub = 'Starting local trading floor…';
  else if (connected) sub = 'Loading trading floor…';
  else if (reason === 'timeout' || reason === 'connect_error') sub = 'Server unreachable — switching to local mode…';

  return (
    <div className="boot-screen boot-trading">
      <div className="boot-scanlines" aria-hidden="true" />
      <div className="boot-vignette" aria-hidden="true" />
      <div className="boot-content">
        <div className="boot-mark">
          <IconMarket size={56} />
          <div className="boot-mark-ring" />
        </div>
        <div className="boot-brand">
          <span className="boot-kicker">SOLANA MAINNET · pump.fun</span>
          <h1 className="boot-title">AI DRAMA ISLAND</h1>
        </div>
        <p className="boot-sub">{sub}</p>
        <div className="boot-progress">
          <div className="boot-progress-fill" />
        </div>
        <div className="boot-signal">
          <span className="boot-signal-dot" />
          <span>5 AI TRADERS INITIALIZING</span>
        </div>
      </div>
    </div>
  );
}
