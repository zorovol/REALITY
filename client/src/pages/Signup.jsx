import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import { api } from '../lib/api.js';

export default function Signup() {
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const res = await api.signup(password);
      setWallet(res.walletAddress);
      setTimeout(() => nav('/dashboard'), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyWallet() {
    if (wallet) navigator.clipboard?.writeText(wallet);
  }

  return (
    <div className="auth-shell">
      <PlatformNav />
      <div className="auth-center">
        <div className="auth-card">
          <div className="auth-card-head">
            <h1>Create account</h1>
            <p>A Solana wallet is generated automatically. Save your address — it&apos;s your login username.</p>
          </div>

          {wallet ? (
            <div className="auth-success">
              <div className="auth-success-icon">✓</div>
              <h2>You&apos;re in!</h2>
              <p>Your wallet address (username):</p>
              <div className="auth-wallet-box">
                <code>{wallet}</code>
                <button type="button" className="auth-copy-btn" onClick={copyWallet}>Copy</button>
              </div>
              <p className="auth-hint">Fund this wallet with SOL, then create a bot on your dashboard. Redirecting…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="auth-form">
              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                <span>Confirm password</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                />
              </label>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Creating wallet…' : 'Sign up'}
              </button>
            </form>
          )}

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
