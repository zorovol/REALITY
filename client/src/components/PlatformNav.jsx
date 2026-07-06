import { Link } from 'react-router-dom';
import { IconX } from './Icons.jsx';
import { BRAND } from '../config/brand.js';

const X_URL = import.meta.env.VITE_X_URL || BRAND.xUrl;

export default function PlatformNav({ user }) {
  return (
    <nav className="platform-nav">
      <Link to="/" className="platform-nav-brand">
        <img src="/logo.png" alt="" className="platform-nav-logo" width={32} height={32} />
        {BRAND.name}
      </Link>
      <div className="platform-nav-links">
        <Link to="/docs">Docs</Link>
        <Link to="/live">Trading Floor</Link>
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
