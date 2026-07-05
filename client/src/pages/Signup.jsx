import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
      setTimeout(() => nav('/dashboard'), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="platform-page">
      <div className="platform-card">
        <h1>Create Account</h1>
        <p className="platform-sub">A Solana wallet is generated automatically. Your wallet address becomes your username.</p>

        {wallet ? (
          <div className="platform-success">
            <p>Account created!</p>
            <code className="platform-wallet">{wallet}</code>
            <p className="platform-hint">Save this address — it is your login username. Redirecting to dashboard…</p>
          </div>
        ) : (
          <form onSubmit={submit} className="platform-form">
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
            </label>
            <label>
              Confirm password
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </label>
            {error && <p className="platform-error">{error}</p>}
            <button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Sign up'}</button>
          </form>
        )}

        <p className="platform-footer-link">Already have an account? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  );
}
