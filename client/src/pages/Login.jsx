import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    <div className="platform-page">
      <div className="platform-card">
        <h1>Log in</h1>
        <p className="platform-sub">Username = your wallet address</p>
        <form onSubmit={submit} className="platform-form">
          <label>
            Wallet address
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {error && <p className="platform-error">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Logging in…' : 'Log in'}</button>
        </form>
        <p className="platform-footer-link">No account? <Link to="/signup">Sign up</Link></p>
      </div>
    </div>
  );
}
