import { Link } from 'react-router-dom';
import { IconX } from './Icons.jsx';

const X_URL = import.meta.env.VITE_X_URL || 'https://x.com/gptgrokgdsfable?s=11';

export default function PlatformNav({ user }) {
  return (
    <nav className="platform-nav">
      <Link to="/" className="platform-nav-brand">
        <span className="platform-nav-dot" />
        GPTGrokGeminiDeepSeekFable
      </Link>
      <div className="platform-nav-links">
        <Link to="/live">Live Floor</Link>
        {user ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <span className="platform-nav-wallet" title={user.walletAddress}>
              {user.walletAddress.slice(0, 4)}…{user.walletAddress.slice(-4)}
            </span>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/signup" className="platform-nav-cta">Sign up</Link>
          </>
        )}
        <a href={X_URL} target="_blank" rel="noopener noreferrer" className="platform-nav-x" aria-label="X">
          <IconX size={16} />
        </a>
      </div>
    </nav>
  );
}
