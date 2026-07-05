import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import { api } from '../lib/api.js';

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.login(username.trim(), password);
      nav('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <PlatformNav />
      <div className="auth-center">
        <div className="auth-card">
          <div className="auth-card-head">
            <h1>Welcome back</h1>
            <p>Log in with your wallet address and password.</p>
          </div>

          <form onSubmit={submit} className="auth-form">
            <label>
              <span>Wallet address</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your Solana public key"
                autoComplete="username"
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <p className="auth-switch">
            No account? <Link to="/signup">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
