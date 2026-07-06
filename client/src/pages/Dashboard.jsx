import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import { getSession, clearSession, getWalletSecretKey } from '../lib/walletAuth.js';
import { api } from '../lib/api.js';
import { syncBotToFloor, syncWalletToServer } from '../lib/serverSync.js';
import { BOT_TYPES, defaultTradingRules } from '../lib/localBots.js';
import { BOT_META, botMeta } from '../lib/botTypes.js';
import Character from '../components/Character.jsx';

const emptyForm = () => ({
  name: '',
  botType: 'chatgpt',
  tradingRules: defaultTradingRules(),
});

export default function Dashboard() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [bots, setBots] = useState([]);
  const [defaults] = useState(defaultTradingRules());
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [syncWarning, setSyncWarning] = useState('');
  const [tradingReady, setTradingReady] = useState(true);
  const [syncPassword, setSyncPassword] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagError, setDiagError] = useState('');

  const load = useCallback(async () => {
    const session = getSession();
    if (!session) {
      nav('/login');
      return;
    }
    setUser(session);
    try {
      const [me, botRes, bal, diag] = await Promise.all([
        api.me(),
        api.listBots(),
        api.walletBalance().catch(() => ({ balanceSol: null })),
        api.tradingDiagnostics().catch((err) => {
          setDiagError(err.message);
          return null;
        }),
      ]);
      setUser({ walletAddress: me.walletAddress, createdAt: me.createdAt });
      setTradingReady(me.tradingReady !== false);
      setBots(botRes.bots);
      setBalance(bal.balanceSol);
      setDiagnostics(diag);
      if (diag) setDiagError('');
    } catch (err) {
      setSyncWarning(err.message);
      setBots([]);
      setDiagnostics(null);
    }
    setLoading(false);
  }, [nav]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function resyncWallet(e) {
    e.preventDefault();
    setSyncLoading(true);
    setError('');
    try {
      const secretKey = await getWalletSecretKey(user.walletAddress, syncPassword);
      if (!secretKey) throw new Error('Wrong password for this wallet.');
      await syncWalletToServer({ walletAddress: user.walletAddress, password: syncPassword, secretKey });
      setSyncPassword('');
      await load();
    } catch (err) {
      setSyncWarning(err.message);
    } finally {
      setSyncLoading(false);
    }
  }

  async function clearPosition(bot) {
    try {
      await api.clearBotPosition(bot.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function logout() {
    try { await api.logout(); } catch { /* local ok */ }
    clearSession();
    nav('/');
  }

  async function createBotSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = form.name.trim();
    if (trimmed.length < 2) {
      return setError('Name your bot (min 2 characters) — required for the trading floor.');
    }
    try {
      const { bot } = await api.createBot({ ...form, name: trimmed });
      await syncBotToFloor(bot, user.walletAddress);
      setForm(emptyForm());
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleBot(bot) {
    try {
      const res = bot.isActive ? await api.stopBot(bot.id) : await api.startBot(bot.id);
      await syncBotToFloor(res.bot, user.walletAddress);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveBotName(bot, name) {
    try {
      const { bot: updated } = await api.updateBot(bot.id, { name: name.trim() });
      await syncBotToFloor(updated, user.walletAddress);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeBot(id) {
    if (!confirm('Delete this bot permanently?')) return;
    try {
      const { unpublishFloorBot } = await import('../lib/floorApi.js');
      await api.deleteBot(id);
      await unpublishFloorBot(id, user.walletAddress).catch(() => {});
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function copyWallet() {
    if (user?.walletAddress) {
      navigator.clipboard?.writeText(user.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function ruleInput(key, label, step = 'any') {
    return (
      <label key={key} className="dash-rule-field">
        <span>{label}</span>
        <input
          type="number"
          step={step}
          value={form.tradingRules[key] ?? defaults[key] ?? ''}
          onChange={(e) => setForm({
            ...form,
            tradingRules: { ...form.tradingRules, [key]: Number(e.target.value) },
          })}
        />
      </label>
    );
  }

  const activeCount = bots.filter((b) => b.isActive).length;
  const onFloorCount = bots.filter((b) => (b.name || '').trim().length >= 2).length;

  if (loading) {
    return (
      <div className="dash-shell">
        <PlatformNav />
        <div className="dash-loading">Loading dashboard…</div>
      </div>
    );
  }

  return (
    <div className="dash-shell">
      <PlatformNav user={user} />

      <div className="dash-layout">
        <aside className="dash-sidebar">
          <div className="dash-wallet-panel">
            <h2>Your wallet</h2>
            <div className="dash-balance">
              <span className="dash-balance-val">{balance != null ? balance.toFixed(4) : '—'}</span>
              <span className="dash-balance-unit">SOL</span>
            </div>
            <div className="dash-wallet-addr">
              <code>{user?.walletAddress}</code>
              <button type="button" onClick={copyWallet}>{copied ? 'Copied!' : 'Copy'}</button>
            </div>
            <p className="dash-hint">Fund with SOL — bots trade on pump.fun mainnet when started.</p>
          </div>

          <div className="dash-sidebar-stats">
            <div><span>{bots.length}</span><small>Bots</small></div>
            <div><span>{activeCount}</span><small>Trading</small></div>
            <div><span>{onFloorCount}</span><small>On floor</small></div>
          </div>

          <button type="button" className="dash-logout" onClick={logout}>Log out</button>
        </aside>

        <main className="dash-main">
          <div className="dash-diagnostics">
            <h3 className="dash-diagnostics-title">Trading engine</h3>
            {diagError ? (
              <p className="dash-bot-status-line">
                Could not load engine status: {diagError}
                {' '}(Render may still be deploying — hard refresh in a minute)
              </p>
            ) : diagnostics ? (
              <>
                <p>
                  <strong>Status:</strong>{' '}
                  {diagnostics.engineRunning ? 'running' : 'offline'}
                  {' · '}
                  <strong>Mode:</strong>{' '}
                  {diagnostics.simulationFallback ? 'simulation — set SIMULATION_FALLBACK=false on Render' : 'live'}
                  {' · '}
                  <strong>Wallet synced:</strong>{' '}
                  {diagnostics.tradingReady ? 'yes' : 'no — sync below'}
                  {' · '}
                  <strong>Tokens in your mcap range:</strong> {diagnostics.candidatesInRange ?? '—'}
                </p>
                {diagnostics.botStatus?.map((b) => (
                  <p key={b.id} className="dash-bot-status-line">
                    <em>{b.name}</em>
                    {b.lastStatus ? `: ${b.lastStatus.reason}` : b.isActive ? ': scanning for trades…' : ': stopped'}
                  </p>
                ))}
              </>
            ) : (
              <p>Loading engine status…</p>
            )}
            <p className="dash-build-stamp">Build {typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : 'local'}</p>
          </div>

          {(!tradingReady || syncWarning) && (
            <div className="dash-local-notice">
              <p>{syncWarning || 'Wallet not synced for on-chain trading — bots cannot sign transactions.'}</p>
              <form onSubmit={resyncWallet} className="dash-sync-form">
                <input
                  type="password"
                  value={syncPassword}
                  onChange={(e) => setSyncPassword(e.target.value)}
                  placeholder="Enter your password to sync wallet"
                  autoComplete="current-password"
                  required
                />
                <button type="submit" className="home-btn primary" disabled={syncLoading}>
                  {syncLoading ? 'Syncing…' : 'Sync wallet for trading'}
                </button>
              </form>
            </div>
          )}

          <header className="dash-header">
            <div>
              <h1>Trading bots</h1>
              <p>Name each bot, hit Start — the server trades on-chain every ~3s. Named bots appear on the <Link to="/live">trading floor</Link>.</p>
            </div>
            <button type="button" className="home-btn primary" onClick={() => { setForm(emptyForm()); setShowCreate(true); }}>
              + Create bot
            </button>
          </header>

          {showCreate && (
            <section className="dash-create-panel">
              <div className="dash-create-head">
                <h2>New bot</h2>
                <button type="button" className="dash-close" onClick={() => setShowCreate(false)}>×</button>
              </div>

              <form onSubmit={createBotSubmit} className="dash-rules-form">
                <label className="dash-name-field">
                  <span>Bot name <em>(shows on trading floor)</em></span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Grok Alpha, Moon Hunter…"
                    maxLength={32}
                    required
                  />
                </label>

                <h3>AI type</h3>
                <div className="dash-type-grid">
                  {BOT_TYPES.map((t) => {
                    const meta = BOT_META[t] ?? { label: t, desc: '', color: '#94a3b8' };
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`dash-type-card ${form.botType === t ? 'selected' : ''}`}
                        style={{ '--type-color': meta.color }}
                        onClick={() => setForm({ ...form, botType: t })}
                      >
                        <Character id={t} size={40} className="dash-type-char" />
                        <strong>{meta.label}</strong>
                        <span>{meta.desc}</span>
                      </button>
                    );
                  })}
                </div>

                <h3>Trading rules</h3>
                <div className="dash-rules-grid">
                  {ruleInput('minMarketCap', 'Min market cap ($)', 100)}
                  {ruleInput('maxMarketCap', 'Max market cap ($)', 100)}
                  {ruleInput('buyAmountSol', 'Buy amount (SOL)', 0.001)}
                  {ruleInput('takeProfitPercent', 'Take profit (%)', 1)}
                  {ruleInput('stopLossPercent', 'Stop loss (%)', 1)}
                </div>
                {error && <div className="auth-error">{error}</div>}
                <div className="dash-create-actions">
                  <button type="button" className="home-btn secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="home-btn primary">Create & publish to floor</button>
                </div>
              </form>
            </section>
          )}

          {!bots.length && !showCreate && (
            <div className="dash-empty">
              <h3>No bots yet</h3>
              <p>Create a named bot, fund your wallet with SOL, then hit Start to trade on-chain.</p>
              <button type="button" className="home-btn primary" onClick={() => setShowCreate(true)}>Create bot</button>
            </div>
          )}

          <div className="dash-bot-grid">
            {bots.map((bot) => {
              const meta = botMeta(bot.botType);
              const onFloor = (bot.name || '').trim().length >= 2;
              return (
                <article key={bot.id} className={`dash-bot-card ${bot.isActive ? 'is-active' : ''}`}>
                  <div className="dash-bot-top">
                    <span className="dash-bot-badge" style={{ background: `${meta.color}22`, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span className={`dash-bot-pill ${bot.isActive ? 'on' : 'off'}`}>
                      {bot.isActive ? '● TRADING' : '○ STOPPED'}
                    </span>
                  </div>

                  <label className="dash-bot-name-field">
                    <span>Floor name</span>
                    <input
                      type="text"
                      defaultValue={bot.name || ''}
                      placeholder="Name to appear on floor"
                      maxLength={32}
                      onBlur={(e) => saveBotName(bot, e.target.value)}
                    />
                  </label>
                  {!onFloor && (
                    <p className="dash-bot-name-hint">Add a name (2+ chars) to appear on the trading floor.</p>
                  )}

                  {bot.position && (
                    <div className="dash-position">
                      Holding <strong>${bot.position.symbol}</strong>
                      {bot.position.entryMcap && ` · ~$${Math.round(bot.position.entryMcap)} mcap`}
                      <button type="button" className="dash-clear-pos" onClick={() => clearPosition(bot)}>
                        Clear stuck position
                      </button>
                    </div>
                  )}

                  <ul className="dash-bot-rules">
                    <li><strong>MCap</strong> ${bot.tradingRules.minMarketCap?.toLocaleString()} – ${bot.tradingRules.maxMarketCap?.toLocaleString()}</li>
                    <li><strong>Buy</strong> {bot.tradingRules.buyAmountSol} SOL</li>
                    <li><strong>TP / SL</strong> {bot.tradingRules.takeProfitPercent}% / {bot.tradingRules.stopLossPercent}%</li>
                  </ul>

                  <div className="dash-bot-actions">
                    <button
                      type="button"
                      className={bot.isActive ? 'home-btn secondary' : 'home-btn primary'}
                      onClick={() => toggleBot(bot)}
                    >
                      {bot.isActive ? 'Stop' : 'Start trading'}
                    </button>
                    <button type="button" className="dash-delete" onClick={() => removeBot(bot.id)}>Delete</button>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="dash-footer-link"><Link to="/live">View the public trading floor →</Link></p>
        </main>
      </div>
    </div>
  );
}
