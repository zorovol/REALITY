import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import { createAccount } from '../lib/walletAuth.js';
import { syncWalletToServer } from '../lib/serverSync.js';

export default function Signup() {
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [savedKey, setSavedKey] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const res = await createAccount(password);
      await syncWalletToServer({
        walletAddress: res.walletAddress,
        password,
        secretKey: res.secretKey,
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copy(text) {
    navigator.clipboard?.writeText(text);
  }

  function goDashboard() {
    if (!savedKey) return setError('Confirm you saved your private key before continuing.');
    nav('/dashboard');
  }

  return (
    <div className="auth-shell">
      <PlatformNav />
      <div className="auth-center">
        <div className="auth-card auth-card-wide">
          <div className="auth-card-head">
            <h1>Create wallet</h1>
            <p>
              Pick a password — we generate a fresh Robinhood Chain wallet in your browser.
              Log in anytime with your <strong>wallet address + password</strong>.
            </p>
          </div>

          {result ? (
            <div className="auth-success auth-success-left">
              <div className="auth-success-icon">✓</div>
              <h2>Wallet created</h2>

              <p className="auth-label">Wallet address (your username)</p>
              <div className="auth-wallet-box">
                <code>{result.walletAddress}</code>
                <button type="button" className="auth-copy-btn" onClick={() => copy(result.walletAddress)}>Copy</button>
              </div>

              <p className="auth-label auth-label-warn">Private key — save this now</p>
              <div className="auth-wallet-box auth-key-box">
                <code>{result.secretKey}</code>
                <button type="button" className="auth-copy-btn" onClick={() => copy(result.secretKey)}>Copy</button>
              </div>
              <p className="auth-hint auth-hint-warn">
                Stored encrypted on this device only. If you clear browser data, you need this key to recover access.
              </p>

              <label className="auth-confirm-save">
                <input
                  type="checkbox"
                  checked={savedKey}
                  onChange={(e) => setSavedKey(e.target.checked)}
                />
                I saved my wallet address and private key
              </label>

              {error && <div className="auth-error">{error}</div>}

              <button type="button" className="auth-submit" onClick={goDashboard}>
                Go to dashboard
              </button>
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
                {loading ? 'Generating wallet…' : 'Generate wallet'}
              </button>
            </form>
          )}

          <p className="auth-switch">
            Already have a wallet? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
