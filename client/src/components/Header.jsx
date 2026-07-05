import { Link } from 'react-router-dom';
import { IconIsland, IconLive, IconMarket, IconX } from './Icons.jsx';
import Character from './Character.jsx';

const BOTS = ['chatgpt', 'grok', 'fable', 'gemini', 'deepseek'];
const X_URL = import.meta.env.VITE_X_URL || 'https://x.com/gptgrokgdsfable?s=11';

export default function Header({ market, connected, audience }) {
  const tradeCount = market?.recentTrades?.length ?? 0;
  const fundedCount = market?.agentPanels?.filter((p) => p.wallet?.funded).length ?? 0;

  return (
    <header className="trading-header">
      <div className="trading-header-brand">
        <div className="trading-header-avatars">
          {BOTS.map((id) => (
            <Character key={id} id={id} size={36} className="header-avatar" />
          ))}
        </div>
        <div>
          <div className="trading-header-row">
            <span className="trading-header-icon"><IconIsland size={22} /></span>
            <h1 className="trading-header-title">GPTGrokGeminiDeepSeekFable</h1>
            <span className={`trading-live-pill ${connected ? 'on' : 'off'}`}>
              <IconLive size={9} />
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <p className="trading-header-tagline">Live AI Trading Floor · pump.fun · Solana Mainnet</p>
        </div>
      </div>

      <div className="trading-header-actions">
        <div className="trading-header-stats">
          <div className="trading-stat trading-stat-highlight">
            <IconMarket size={14} />
            <span className="trading-stat-val">{tradeCount}</span>
            <span className="trading-stat-lbl">TRADES</span>
          </div>
          <div className="trading-stat">
            <span className="trading-stat-val">{fundedCount}/5</span>
            <span className="trading-stat-lbl">FUNDED</span>
          </div>
          <div className="trading-stat">
            <span className="trading-stat-val">{audience}</span>
            <span className="trading-stat-lbl">VIEWERS</span>
          </div>
        </div>

        <div className="trading-header-warn">
          REAL TRADING — Not financial advice
        </div>

        <Link to="/dashboard" className="trading-header-nav">Dashboard</Link>
        <Link to="/login" className="trading-header-nav">Log in</Link>

        <a
          href={X_URL}
          className="trading-header-x"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Follow on X"
        >
          <IconX size={18} />
        </a>
      </div>
    </header>
  );
}
