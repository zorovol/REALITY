import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import { getSession, clearSession, getWalletSecretKey } from '../lib/walletAuth.js';
import { api } from '../lib/api.js';
import { syncBotToFloor, syncWalletToServer } from '../lib/serverSync.js';
import { BOT_TYPES, defaultTradingRules } from '../lib/localBots.js';
import { BOT_META, botMeta } from '../lib/botTypes.js';
import Character from '../components/Character.jsx';
import { BRAND } from '../config/brand.js';
import { CHAIN, addRobinhoodChainToWallet } from '../config/chain.js';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'bots', label: 'My Bots' },
  { id: 'engine', label: 'Engine' },
  { id: 'wallet', label: 'Wallet' },
];

const emptyForm = () => ({
  name: '',
  botType: 'chatgpt',
  tradingRules: defaultTradingRules(),
});

function shortAddr(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

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
  const [tab, setTab] = useState('overview');
  const [mmError, setMmError] = useState('');

  const addRobinhoodNetwork = async () => {
    setMmError('');
    try {
      await addRobinhoodChainToWallet();
    } catch (err) {
      setMmError(err.message || 'Could not add network to MetaMask');
    }
  };

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
        api.walletBalance().catch(() => ({ balanceEth: null, balanceSol: null })),
        api.tradingDiagnostics().catch((err) => {
          setDiagError(err.message);
          return null;
        }),
      ]);
      setUser({ walletAddress: me.walletAddress, createdAt: me.createdAt });
      setTradingReady(me.tradingReady !== false);
      setBots(botRes.bots);
      setBalance(bal.balanceEth ?? bal.balanceSol);
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
      setTab('bots');
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
      <label key={key} className="dash-v2-rule-field">
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
  const engineRunning = diagnostics?.engineRunning;
  const engineMode = diagnostics?.simulationFallback ? 'Simulation' : 'Live';

  const terminalLines = diagnostics?.botStatus?.length
    ? diagnostics.botStatus.slice(0, 6).map((b, i) => ({
        time: `04:${String(12 + i).padStart(2, '0')}:${String(i * 7).padStart(2, '0')}`,
        agent: (b.name || 'BOT').slice(0, 8).toUpperCase(),
        msg: b.lastStatus?.reason || (b.isActive ? 'scanning memecoins…' : 'stopped'),
        type: b.isActive ? 'buy' : 'info',
      }))
    : [
        { time: '—', agent: 'ENGINE', msg: diagError || 'Waiting for engine status…', type: 'info' },
      ];

  function renderBotCard(bot) {
    const meta = botMeta(bot.botType);
    const onFloor = (bot.name || '').trim().length >= 2;
    return (
      <article key={bot.id} className={`dash-v2-bot-card ${bot.isActive ? 'is-active' : ''}`} style={{ '--accent': meta.color }}>
        <div className="dash-v2-bot-head">
          <div className="dash-v2-bot-identity">
            <Character id={bot.botType} size={44} className="dash-v2-bot-char" />
            <div>
              <span className="dash-v2-bot-type" style={{ color: meta.color }}>{meta.label}</span>
              <span className={`dash-v2-bot-pill ${bot.isActive ? 'on' : 'off'}`}>
                {bot.isActive ? '● TRADING' : '○ STOPPED'}
              </span>
            </div>
          </div>
        </div>

        <label className="dash-v2-bot-name-field">
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
          <p className="dash-v2-bot-hint">Add a name (2+ chars) to appear on the trading floor.</p>
        )}

        {bot.position && (
          <div className="dash-v2-position">
            Holding <strong>${bot.position.symbol}</strong>
            {bot.position.entryMcap && ` · ~$${Math.round(bot.position.entryMcap)} mcap`}
            <button type="button" className="dash-v2-clear-pos" onClick={() => clearPosition(bot)}>
              Clear stuck position
            </button>
          </div>
        )}

        <ul className="dash-v2-bot-rules">
          <li><strong>MCap</strong> ${bot.tradingRules.minMarketCap?.toLocaleString()} – ${bot.tradingRules.maxMarketCap?.toLocaleString()}</li>
          <li><strong>Buy</strong> {bot.tradingRules.buyAmountEth ?? bot.tradingRules.buyAmountSol} ETH</li>
          <li><strong>TP / SL</strong> {bot.tradingRules.takeProfitPercent}% / {bot.tradingRules.stopLossPercent}%</li>
        </ul>

        <div className="dash-v2-bot-actions">
          <button
            type="button"
            className={bot.isActive ? 'home-v2-btn ghost' : 'home-v2-btn primary'}
            onClick={() => toggleBot(bot)}
          >
            {bot.isActive ? 'Stop' : 'Start trading'}
          </button>
          <button type="button" className="dash-v2-delete" onClick={() => removeBot(bot.id)}>Delete</button>
        </div>
      </article>
    );
  }

  function renderCreatePanel() {
    if (!showCreate) return null;
    return (
      <section className="dash-v2-create">
        <div className="dash-v2-create-head">
          <div>
            <p className="home-v2-eyebrow">New bot</p>
            <h2>Configure your agent</h2>
          </div>
          <button type="button" className="dash-v2-close" onClick={() => setShowCreate(false)} aria-label="Close">×</button>
        </div>

        <form onSubmit={createBotSubmit} className="dash-v2-create-form">
          <label className="dash-v2-name-field">
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
          <div className="dash-v2-type-grid">
            {BOT_TYPES.map((t) => {
              const meta = BOT_META[t] ?? { label: t, desc: '', color: '#94a3b8' };
              return (
                <button
                  key={t}
                  type="button"
                  className={`dash-v2-type-card ${form.botType === t ? 'selected' : ''}`}
                  style={{ '--accent': meta.color }}
                  onClick={() => setForm({ ...form, botType: t })}
                >
                  <Character id={t} size={40} className="dash-v2-type-char" />
                  <strong>{meta.label}</strong>
                  <span>{meta.desc}</span>
                </button>
              );
            })}
          </div>

          <h3>Trading rules</h3>
          <div className="dash-v2-rules-grid">
            {ruleInput('minMarketCap', 'Min market cap ($)', 100)}
            {ruleInput('maxMarketCap', 'Max market cap ($)', 100)}
            {ruleInput('buyAmountEth', 'Buy amount (ETH, ~$5)', 0.0001)}
            {ruleInput('takeProfitPercent', 'Take profit (%)', 1)}
            {ruleInput('stopLossPercent', 'Stop loss (%)', 1)}
          </div>
          {error && <div className="auth-error">{error}</div>}
          <div className="dash-v2-create-actions">
            <button type="button" className="home-v2-btn ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="home-v2-btn primary">Create & publish to floor</button>
          </div>
        </form>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="dash-v2">
        <div className="dash-v2-bg" aria-hidden="true">
          <div className="home-v2-orb home-v2-orb-a" />
          <div className="home-v2-orb home-v2-orb-b" />
          <div className="home-v2-grid" />
        </div>
        <PlatformNav />
        <div className="dash-v2-loading">
          <span className="home-v2-live-dot" />
          Loading your dashboard…
        </div>
      </div>
    );
  }

  return (
    <div className="dash-v2">
      <div className="dash-v2-bg" aria-hidden="true">
        <div className="home-v2-orb home-v2-orb-a" />
        <div className="home-v2-orb home-v2-orb-b" />
        <div className="home-v2-orb home-v2-orb-c" />
        <div className="home-v2-grid" />
        <div className="home-v2-noise" />
      </div>

      <PlatformNav user={user} />

      <div className="dash-v2-body">
        {/* Hero */}
        <header className="dash-v2-hero">
          <div className="dash-v2-hero-main">
            <div className="home-v2-live">
              <span className="home-v2-live-dot" />
              {BRAND.chainName.toUpperCase()} · YOUR DASHBOARD
            </div>
            <h1>
              Command <em>center</em>
            </h1>
            <p className="dash-v2-hero-lead">
              Name each bot, hit Start — {BRAND.name} trades live memecoins every ~3s on {BRAND.chainName}.
            </p>
            <div className="dash-v2-hero-cta">
              <button type="button" className="home-v2-btn primary" onClick={() => { setForm(emptyForm()); setShowCreate(true); setTab('bots'); }}>
                + Create bot
              </button>
              <Link to="/live" className="home-v2-btn ghost">Trading floor</Link>
              <button type="button" className="home-v2-btn ghost subtle" onClick={logout}>Log out</button>
            </div>
          </div>

          <div className="dash-v2-wallet-card">
            <div className="dash-v2-wallet-top">
              <span className="dash-v2-wallet-label">Wallet balance</span>
              <button type="button" className="dash-v2-copy-btn" onClick={copyWallet}>
                {copied ? 'Copied!' : 'Copy address'}
              </button>
            </div>
            <div className="dash-v2-balance">
              <span className="dash-v2-balance-val">{balance != null ? balance.toFixed(4) : '—'}</span>
              <span className="dash-v2-balance-unit">ETH</span>
            </div>
            <code className="dash-v2-wallet-addr">{user?.walletAddress}</code>
            <p className="dash-v2-wallet-hint">Fund with ~$10+ ETH on {BRAND.chainName} — ~$5 per buy + gas via Uniswap V3.</p>
          </div>
        </header>

        {/* Metrics strip */}
        <div className="dash-v2-metrics">
          <div><strong>{bots.length}</strong><span>Total bots</span></div>
          <div><strong>{activeCount}</strong><span>Trading now</span></div>
          <div><strong>{onFloorCount}</strong><span>On floor</span></div>
          <div className={engineRunning ? 'is-live' : ''}>
            <strong>{engineRunning ? 'Live' : 'Offline'}</strong>
            <span>Engine · {engineMode}</span>
          </div>
        </div>

        {/* Sync warning */}
        {(!tradingReady || syncWarning) && (
          <div className="dash-v2-sync-banner">
            <p>{syncWarning || 'Wallet not synced for on-chain trading — bots cannot sign transactions.'}</p>
            <form onSubmit={resyncWallet} className="dash-v2-sync-form">
              <input
                type="password"
                value={syncPassword}
                onChange={(e) => setSyncPassword(e.target.value)}
                placeholder="Enter password to sync wallet"
                autoComplete="current-password"
                required
              />
              <button type="submit" className="home-v2-btn primary" disabled={syncLoading}>
                {syncLoading ? 'Syncing…' : 'Sync wallet'}
              </button>
            </form>
          </div>
        )}

        {/* Tabs */}
        <nav className="dash-v2-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="dash-v2-content">
          {tab === 'overview' && (
            <div className="dash-v2-overview">
              <div className="dash-v2-overview-grid">
                <div className="home-v2-terminal dash-v2-terminal">
                  <div className="home-v2-terminal-bar">
                    <span /><span /><span />
                    <p>botforge-engine · {engineRunning ? 'live' : 'offline'}</p>
                  </div>
                  <div className="home-v2-terminal-body">
                    {terminalLines.map((line) => (
                      <div key={`${line.time}-${line.msg}`} className={`home-v2-terminal-line ${line.type}`}>
                        <span className="home-v2-terminal-time">{line.time}</span>
                        <span className="home-v2-terminal-agent">{line.agent}</span>
                        <span className="home-v2-terminal-msg">{line.msg}</span>
                      </div>
                    ))}
                    <span className="home-v2-terminal-cursor">▊</span>
                  </div>
                </div>

                <div className="dash-v2-side-stack">
                  <article className="dash-v2-card accent">
                    <span className="home-v2-split-tag">Engine status</span>
                    {diagError ? (
                      <p className="dash-v2-card-text">Could not load: {diagError}</p>
                    ) : diagnostics ? (
                      <>
                        <h3>{diagnostics.engineRunning ? 'Engine running' : 'Engine offline'}</h3>
                        <p className="dash-v2-card-text">
                          Mode: <strong>{engineMode}</strong>
                          {' · '}Wallet synced: <strong>{diagnostics.tradingReady ? 'yes' : 'no'}</strong>
                          {diagnostics.candidatesInRange != null && (
                            <> · Candidates: <strong>{diagnostics.candidatesInRange}</strong></>
                          )}
                          {diagnostics.routableInRange != null && (
                            <> · V3 swappable: <strong>{diagnostics.routableInRange}</strong></>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="dash-v2-card-text">Loading engine status…</p>
                    )}
                    <button type="button" className="home-v2-link" onClick={() => setTab('engine')}>View details →</button>
                  </article>

                  <article className="dash-v2-card">
                    <span className="home-v2-split-tag">Quick actions</span>
                    <div className="dash-v2-quick-actions">
                      <button type="button" className="home-v2-btn primary" onClick={() => { setForm(emptyForm()); setShowCreate(true); setTab('bots'); }}>
                        + New bot
                      </button>
                      <Link to="/live" className="home-v2-btn ghost">View floor</Link>
                      <button type="button" className="home-v2-btn ghost subtle" onClick={() => setTab('wallet')}>
                        Wallet details
                      </button>
                    </div>
                  </article>

                  <article className="dash-v2-card">
                    <span className="home-v2-split-tag">Your bots</span>
                    <h3>{bots.length ? `${activeCount} of ${bots.length} trading` : 'No bots yet'}</h3>
                    <p className="dash-v2-card-text">
                      {bots.length
                        ? 'Active bots scan Ape.Store + NOXA Fun and execute on Uniswap V3.'
                        : 'Create your first bot to start automated memecoin trading.'}
                    </p>
                    {bots.length > 0 && (
                      <button type="button" className="home-v2-link" onClick={() => setTab('bots')}>Manage bots →</button>
                    )}
                  </article>
                </div>
              </div>

              {bots.length > 0 && (
                <section className="dash-v2-active-section">
                  <div className="dash-v2-section-head">
                    <p className="home-v2-eyebrow">Active fleet</p>
                    <h2>Your trading bots</h2>
                  </div>
                  <div className="dash-v2-bot-grid compact">
                    {bots.slice(0, 3).map(renderBotCard)}
                  </div>
                  {bots.length > 3 && (
                    <button type="button" className="home-v2-link dash-v2-see-all" onClick={() => setTab('bots')}>
                      View all {bots.length} bots →
                    </button>
                  )}
                </section>
              )}

              {!bots.length && (
                <div className="dash-v2-empty">
                  <div className="dash-v2-empty-icon">⚡</div>
                  <h3>No bots yet</h3>
                  <p>Create a named bot, fund your wallet with ETH on {BRAND.chainName}, then hit Start to trade on-chain.</p>
                  <button type="button" className="home-v2-btn primary" onClick={() => { setForm(emptyForm()); setShowCreate(true); setTab('bots'); }}>
                    Create your first bot
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'bots' && (
            <div className="dash-v2-bots-panel">
              <div className="dash-v2-panel-head">
                <div>
                  <p className="home-v2-eyebrow">Fleet management</p>
                  <h2>My bots</h2>
                </div>
                {!showCreate && (
                  <button type="button" className="home-v2-btn primary" onClick={() => { setForm(emptyForm()); setShowCreate(true); }}>
                    + Create bot
                  </button>
                )}
              </div>

              {renderCreatePanel()}

              {!bots.length && !showCreate && (
                <div className="dash-v2-empty">
                  <div className="dash-v2-empty-icon">🤖</div>
                  <h3>No bots yet</h3>
                  <p>Create a named bot, fund your wallet, then hit Start to trade on-chain.</p>
                  <button type="button" className="home-v2-btn primary" onClick={() => setShowCreate(true)}>Create bot</button>
                </div>
              )}

              {bots.length > 0 && (
                <div className="dash-v2-bot-grid">
                  {bots.map(renderBotCard)}
                </div>
              )}

              <p className="dash-v2-footer-link"><Link to="/live">View the public trading floor →</Link></p>
            </div>
          )}

          {tab === 'engine' && (
            <div className="dash-v2-engine-panel">
              <div className="dash-v2-panel-head">
                <div>
                  <p className="home-v2-eyebrow">Trading engine</p>
                  <h2>System diagnostics</h2>
                </div>
                <span className="dash-v2-build-stamp">
                  Build {typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : 'local'}
                </span>
              </div>

              <div className="home-v2-terminal dash-v2-terminal large">
                <div className="home-v2-terminal-bar">
                  <span /><span /><span />
                  <p>botforge-engine · diagnostics</p>
                </div>
                <div className="home-v2-terminal-body">
                  {diagError ? (
                    <div className="home-v2-terminal-line info">
                      <span className="home-v2-terminal-time">ERR</span>
                      <span className="home-v2-terminal-agent">SYSTEM</span>
                      <span className="home-v2-terminal-msg">Could not load engine status: {diagError}</span>
                    </div>
                  ) : diagnostics ? (
                    <>
                      <div className="home-v2-terminal-line info">
                        <span className="home-v2-terminal-time">SYS</span>
                        <span className="home-v2-terminal-agent">ENGINE</span>
                        <span className="home-v2-terminal-msg">
                          Status: {diagnostics.engineRunning ? 'running' : 'offline'} · Mode: {engineMode}
                        </span>
                      </div>
                      <div className="home-v2-terminal-line info">
                        <span className="home-v2-terminal-time">SYS</span>
                        <span className="home-v2-terminal-agent">WALLET</span>
                        <span className="home-v2-terminal-msg">
                          Synced: {diagnostics.tradingReady ? 'yes' : 'no — sync below'} · Address: {shortAddr(user?.walletAddress)}
                        </span>
                      </div>
                      <div className="home-v2-terminal-line buy">
                        <span className="home-v2-terminal-time">SYS</span>
                        <span className="home-v2-terminal-agent">SCAN</span>
                        <span className="home-v2-terminal-msg">
                          Memecoins in range: {diagnostics.candidatesInRange ?? '—'}
                          {diagnostics.memecoinDiscovery?.poolSize != null && ` · Pool: ${diagnostics.memecoinDiscovery.poolSize} launchpad tokens`}
                        </span>
                      </div>
                      {diagnostics.botStatus?.map((b) => (
                        <div key={b.id} className={`home-v2-terminal-line ${b.isActive ? 'buy' : 'info'}`}>
                          <span className="home-v2-terminal-time">BOT</span>
                          <span className="home-v2-terminal-agent">{(b.name || 'unnamed').slice(0, 8).toUpperCase()}</span>
                          <span className="home-v2-terminal-msg">
                            {b.lastStatus ? b.lastStatus.reason : b.isActive ? 'scanning for trades…' : 'stopped'}
                          </span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="home-v2-terminal-line info">
                      <span className="home-v2-terminal-msg">Loading engine status…</span>
                    </div>
                  )}
                  <span className="home-v2-terminal-cursor">▊</span>
                </div>
              </div>

              {(!tradingReady || syncWarning) && (
                <article className="dash-v2-card accent">
                  <span className="home-v2-split-tag">Wallet sync required</span>
                  <p className="dash-v2-card-text">
                    {syncWarning || 'Your wallet keys are not synced to the server. Bots cannot sign on-chain transactions until you sync.'}
                  </p>
                  <form onSubmit={resyncWallet} className="dash-v2-sync-form">
                    <input
                      type="password"
                      value={syncPassword}
                      onChange={(e) => setSyncPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button type="submit" className="home-v2-btn primary" disabled={syncLoading}>
                      {syncLoading ? 'Syncing…' : 'Sync wallet for trading'}
                    </button>
                  </form>
                </article>
              )}
            </div>
          )}

          {tab === 'wallet' && (
            <div className="dash-v2-wallet-panel">
              <div className="dash-v2-panel-head">
                <div>
                  <p className="home-v2-eyebrow">Your account</p>
                  <h2>Wallet</h2>
                </div>
              </div>

              <div className="dash-v2-wallet-hero">
                <span className="dash-v2-wallet-label">Available balance</span>
                <div className="dash-v2-balance large">
                  <span className="dash-v2-balance-val">{balance != null ? balance.toFixed(6) : '—'}</span>
                  <span className="dash-v2-balance-unit">ETH</span>
                </div>
                <p className="dash-v2-card-text">On {BRAND.chainName} · used for Ape.Store / NOXA memecoin buys via Uniswap V3</p>
              </div>

              <div className="dash-v2-wallet-grid">
                <article className="dash-v2-card">
                  <span className="home-v2-split-tag">Address</span>
                  <code className="dash-v2-full-addr">{user?.walletAddress}</code>
                  <button type="button" className="home-v2-btn ghost" onClick={copyWallet}>
                    {copied ? 'Copied!' : 'Copy full address'}
                  </button>
                </article>

                <article className="dash-v2-card">
                  <span className="home-v2-split-tag">Account</span>
                  <ul className="dash-v2-info-list">
                    <li><span>Chain</span><strong>{BRAND.chainName}</strong></li>
                    <li><span>Native token</span><strong>{BRAND.nativeSymbol}</strong></li>
                    <li><span>Trading ready</span><strong className={tradingReady ? 'green' : 'warn'}>{tradingReady ? 'Yes' : 'No — sync required'}</strong></li>
                    <li><span>Created</span><strong>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</strong></li>
                  </ul>
                </article>
              </div>

              <article className="dash-v2-card">
                <span className="home-v2-split-tag">How to fund</span>
                <p className="dash-v2-card-text">
                  Send ETH to your address above on <strong>{BRAND.chainName}</strong> (chain ID {CHAIN.chainId}) — not Ethereum mainnet.
                  If you import this wallet into MetaMask, add Robinhood Chain first or transactions will fail.
                </p>
                <div className="dash-v2-wallet-actions">
                  <button type="button" className="home-v2-btn ghost" onClick={addRobinhoodNetwork}>
                    Add Robinhood Chain to MetaMask
                  </button>
                  <Link to="/docs" className="home-v2-link">Read setup docs →</Link>
                </div>
                {mmError && <p className="auth-error">{mmError}</p>}
              </article>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
