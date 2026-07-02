import { useCallback, useEffect, useState } from 'react';
import Character from '../components/Character.jsx';

const TOKEN_KEY = 'adi-admin-token';

async function api(path, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };
  return (
    <button type="button" className="admin-copy" onClick={copy}>
      {copied ? 'COPIED' : label}
    </button>
  );
}

function SecretField({ secret }) {
  const [revealed, setRevealed] = useState(false);
  if (!secret) return <span className="admin-muted">—</span>;
  return (
    <div className="admin-secret">
      <code className="admin-secret-text">{revealed ? secret : '•'.repeat(32)}</code>
      <button type="button" className="admin-reveal" onClick={() => setRevealed((v) => !v)}>
        {revealed ? 'HIDE' : 'REVEAL'}
      </button>
      <CopyBtn text={secret} label="COPY KEY" />
    </div>
  );
}

/** Password-protected page at /admin — not linked from the public site. */
export default function AdminPage() {
  const [enabled, setEnabled] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [wallets, setWallets] = useState(null);
  const [network, setNetwork] = useState('');

  const loadWallets = useCallback(async () => {
    const data = await api('/api/admin/wallets');
    setWallets(data.wallets);
    setNetwork(data.network);
  }, []);

  useEffect(() => {
    api('/api/admin/status')
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    loadWallets().catch(() => sessionStorage.removeItem(TOKEN_KEY));
  }, [loadWallets]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      sessionStorage.setItem(TOKEN_KEY, data.token);
      setPassword('');
      await loadWallets();
    } catch (err) {
      setError(err.message);
      sessionStorage.removeItem(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await api('/api/admin/logout', { method: 'POST', body: '{}' });
    } catch { /* ignore */ }
    sessionStorage.removeItem(TOKEN_KEY);
    setWallets(null);
    setPassword('');
  };

  return (
    <div className="admin-page">
      <div className="broadcast-bg" aria-hidden="true">
        <div className="broadcast-bg-gradient trading-bg" />
        <div className="broadcast-bg-noise" />
        <div className="broadcast-bg-vignette" />
      </div>

      <div className="admin-page-inner">
        <header className="admin-head">
          <div>
            <p className="admin-page-kicker">RESTRICTED · /admin</p>
            <h1 className="admin-title">WALLET VAULT</h1>
            <p className="admin-sub">Agent private keys · not visible on the public trading floor</p>
          </div>
          <a href="/" className="admin-back-link">← Trading floor</a>
        </header>

        {enabled === false && (
          <div className="admin-alert admin-alert-warn">
            Admin is disabled. Set <code>ADMIN_PASSWORD</code> in server <code>.env</code> and restart.
          </div>
        )}

        {enabled === null && (
          <p className="admin-muted admin-page-status">Checking admin status…</p>
        )}

        {!wallets && enabled && (
          <form className="admin-login admin-login-page" onSubmit={submit}>
            <h2 className="admin-login-title">Enter admin password</h2>
            <p className="admin-login-hint">This page is not linked from the public site. Only you should know this URL.</p>
            <label className="admin-label" htmlFor="admin-pw">Password</label>
            <input
              id="admin-pw"
              type="password"
              className="admin-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              autoComplete="current-password"
              autoFocus
            />
            {error && <p className="admin-error">{error}</p>}
            <button type="submit" className="admin-submit" disabled={loading || !password}>
              {loading ? 'VERIFYING…' : 'UNLOCK WALLET KEYS'}
            </button>
          </form>
        )}

        {wallets && (
          <>
            <div className="admin-alert admin-alert-danger">
              PRIVATE KEYS — Anyone with these keys controls the wallets. Never share or screenshot.
            </div>
            <div className="admin-toolbar">
              <span className="admin-network">Network: <b>{network}</b></span>
              <button type="button" className="admin-logout" onClick={signOut}>Sign out</button>
            </div>
            <div className="admin-wallet-list">
              {wallets.map((w) => (
                <article key={w.id} className="admin-wallet-card">
                  <div className="admin-wallet-top">
                    <Character id={w.id} size={48} />
                    <div>
                      <h2 className="admin-wallet-name">{w.name}</h2>
                      <span className="admin-wallet-bal">{w.sol} SOL</span>
                    </div>
                  </div>
                  <div className="admin-field">
                    <span className="admin-field-lbl">PUBLIC ADDRESS</span>
                    <div className="admin-field-row">
                      <code className="admin-addr">{w.address}</code>
                      <CopyBtn text={w.address} label="COPY" />
                    </div>
                  </div>
                  <div className="admin-field">
                    <span className="admin-field-lbl">PRIVATE KEY (base58)</span>
                    <SecretField secret={w.secretKey} />
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
