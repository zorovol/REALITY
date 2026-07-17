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
import { CHAIN, addEthereumToWallet } from '../config/chain.js';

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

function HudCorners() {
  return (
    <>
      <i className="tw-hud-c tl" /><i className="tw-hud-c tr" />
      <i className="tw-hud-c bl" /><i className="tw-hud-c br" />
    </>
  );
}

function RadarRing({ on }) {
  return (
    <svg className={`tw-radar ${on ? 'on' : ''}`} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(0,200,5,0.15)" strokeWidth="1" />
      <circle cx="60" cy="60" r="36" fill="none" stroke="rgba(0,200,5,0.2)" strokeWidth="1" />
      <circle cx="60" cy="60" r="20" fill="none" stroke="rgba(0,200,5,0.3)" strokeWidth="1" />
      <circle cx="60" cy="60" r="4" fill="#00c805" />
      <line className="tw-radar-sweep" x1="60" y1="60" x2="60" y2="8" stroke="#00c805" strokeWidth="2" strokeLinecap="round" />
      <circle cx="82" cy="38" r="2.5" fill="#00c805" className="tw-radar-blip" />
      <circle cx="40" cy="70" r="2" fill="#7dff7a" className="tw-radar-blip d2" />
    </svg>
  );
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

  const addEthereumNetwork = async () => {
    setMmError('');
    try {
      await addEthereumToWallet();
    } catch (err) {
      setMmError(err.message || 'Could not switch MetaMask to Ethereum');
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
      <label key={key} className="tw-field">
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
        msg: b.lastStatus?.reason || (b.isActive ? 'scanning stock tokens…' : 'stopped'),
        type: b.isActive ? 'buy' : 'info',
      }))
    : [
        { time: '—', agent: 'ENGINE', msg: diagError || 'Waiting for engine status…', type: 'info' },
      ];

  function renderBotCard(bot) {
    const meta = botMeta(bot.botType);
    const onFloor = (bot.name || '').trim().length >= 2;
    return (
      <article key={bot.id} className={`tw-bot tw-hud ${bot.isActive ? 'is-active' : ''}`} style={{ '--accent': meta.color }}>
        <HudCorners />
        <div className="tw-bot-head">
          <div className="tw-bot-id">
            <Character id={bot.botType} size={44} className="tw-bot-char" />
            <div>
              <span className="tw-bot-type" style={{ color: meta.color }}>{meta.label}</span>
              <span className={`tw-bot-pill ${bot.isActive ? 'on' : 'off'}`}>
                {bot.isActive ? 'TRADING' : 'STOPPED'}
              </span>
            </div>
          </div>
        </div>

        <label className="tw-field">
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
          <p className="tw-hint">Add a name (2+ chars) to appear on the trading floor.</p>
        )}

        {bot.position && (
          <div className="tw-position">
            Holding <strong>{bot.position.symbol}</strong>
            {bot.position.entryPrice
              ? ` · entry $${Number(bot.position.entryPrice).toLocaleString()}`
              : bot.position.entryMcap ? ` · ~$${Math.round(bot.position.entryMcap)} mcap` : ''}
            <button type="button" className="tw-link-btn" onClick={() => clearPosition(bot)}>
              Clear stuck position
            </button>
          </div>
        )}

        <ul className="tw-bot-rules">
          <li><strong>On-chain cap</strong> ${bot.tradingRules.minMarketCap?.toLocaleString()} – ${bot.tradingRules.maxMarketCap?.toLocaleString()}</li>
          <li><strong>Buy</strong> {bot.tradingRules.buyAmountEth ?? bot.tradingRules.buyAmountSol} ETH</li>
          <li><strong>TP / SL</strong> {bot.tradingRules.takeProfitPercent}% / {bot.tradingRules.stopLossPercent}%</li>
        </ul>

        <div className="tw-bot-actions">
          <button
            type="button"
            className={bot.isActive ? 'tw-btn ghost' : 'tw-btn primary'}
            onClick={() => toggleBot(bot)}
          >
            {bot.isActive ? 'Stop' : 'Start trading'}
          </button>
          <button type="button" className="tw-btn danger" onClick={() => removeBot(bot.id)}>Delete</button>
        </div>
      </article>
    );
  }

  function renderCreatePanel() {
    if (!showCreate) return null;
    return (
      <section className="tw-create tw-hud">
        <HudCorners />
        <div className="tw-create-head">
          <div>
            <p className="tw-eyebrow">// NEW_AGENT</p>
            <h2>Configure your agent</h2>
          </div>
          <button type="button" className="tw-close" onClick={() => setShowCreate(false)} aria-label="Close">×</button>
        </div>

        <form onSubmit={createBotSubmit} className="tw-create-form">
          <label className="tw-field">
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
          <div className="tw-type-grid">
            {BOT_TYPES.map((t) => {
              const meta = BOT_META[t] ?? { label: t, desc: '', color: '#94a3b8' };
              return (
                <button
                  key={t}
                  type="button"
                  className={`tw-type-card ${form.botType === t ? 'selected' : ''}`}
                  style={{ '--accent': meta.color }}
                  onClick={() => setForm({ ...form, botType: t })}
                >
                  <Character id={t} size={40} className="tw-type-char" />
                  <strong>{meta.label}</strong>
                  <span>{meta.desc}</span>
                </button>
              );
            })}
          </div>

          <h3>Trading rules</h3>
          <div className="tw-rules-grid">
            {ruleInput('minMarketCap', 'Min on-chain cap ($)', 100)}
            {ruleInput('maxMarketCap', 'Max on-chain cap ($)', 100)}
            {ruleInput('buyAmountEth', 'Buy amount (ETH, ~$15)', 0.0001)}
            {ruleInput('takeProfitPercent', 'Take profit (%)', 1)}
            {ruleInput('stopLossPercent', 'Stop loss (%)', 1)}
          </div>
          {error && <div className="auth-error">{error}</div>}
          <div className="tw-create-actions">
            <button type="button" className="tw-btn ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="tw-btn primary">Create & publish to floor</button>
          </div>
        </form>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="tw tw-x tw-dash">
        <div className="tw-bg" aria-hidden="true">
          <div className="tw-wash" />
          <div className="tw-hex" />
          <div className="tw-chart" />
          <div className="tw-scanline" />
        </div>
        <PlatformNav />
        <div className="tw-dash-loading">
          <span className="tw-live-dot" />
          BOOTING_COMMAND_DESK…
        </div>
      </div>
    );
  }

  return (
    <div className="tw tw-x tw-dash">
      <div className="tw-bg" aria-hidden="true">
        <div className="tw-wash" />
        <div className="tw-hex" />
        <div className="tw-chart" />
        <div className="tw-scanline" />
      </div>

      <PlatformNav user={user} />

      <div className="tw-dash-body">
        <header className="tw-dash-hero">
          <div className="tw-dash-hero-main">
            <p className="tw-live">
              <span className="tw-live-dot" />
              SYS · {BRAND.chainName.toUpperCase()} · CIC
            </p>
            <h1>
              <span className="tw-brand-accent">CIC</span> desk
            </h1>
            <p className="tw-dash-lead">
              Name each bot, hit Start — {BRAND.name} trades Robinhood stocks on Ethereum via Uniswap V3.
            </p>
            <div className="tw-cta">
              <button type="button" className="tw-btn primary" onClick={() => { setForm(emptyForm()); setShowCreate(true); setTab('bots'); }}>
                <span className="tw-btn-glow" />
                + Create bot
              </button>
              <Link to="/live" className="tw-btn ghost">Trading floor</Link>
              <button type="button" className="tw-btn ghost subtle" onClick={logout}>Log out</button>
            </div>
          </div>

          <div className="tw-dash-side">
            <div className="tw-wallet-card tw-hud">
              <HudCorners />
              <div className="tw-wallet-top">
                <span className="tw-wallet-label">WALLET_BAL</span>
                <button type="button" className="tw-copy" onClick={copyWallet}>
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
              <div className="tw-balance">
                <span className="tw-balance-val">{balance != null ? balance.toFixed(4) : '—'}</span>
                <span className="tw-balance-unit">ETH</span>
              </div>
              <code className="tw-wallet-addr">{user?.walletAddress}</code>
              <p className="tw-hint">Fund ETH on {BRAND.chainName} — bots spend balance minus gas.</p>
            </div>
            <div className="tw-radar-card tw-hud">
              <HudCorners />
              <RadarRing on={!!engineRunning} />
              <div className="tw-radar-meta">
                <span>ENGINE</span>
                <strong className={engineRunning ? 'ok' : ''}>{engineRunning ? 'ONLINE' : 'OFFLINE'}</strong>
                <em>{engineMode.toUpperCase()}</em>
              </div>
            </div>
          </div>
        </header>

        <div className="tw-metrics">
          <div className="tw-hud"><HudCorners /><strong>{bots.length}</strong><span>TOTAL_BOTS</span></div>
          <div className="tw-hud"><HudCorners /><strong>{activeCount}</strong><span>TRADING_NOW</span></div>
          <div className="tw-hud"><HudCorners /><strong>{onFloorCount}</strong><span>ON_FLOOR</span></div>
          <div className={`tw-hud ${engineRunning ? 'is-live' : ''}`}>
            <HudCorners />
            <strong>{engineRunning ? 'LIVE' : 'OFF'}</strong>
            <span>ENGINE · {engineMode.toUpperCase()}</span>
          </div>
        </div>

        {(!tradingReady || syncWarning) && (
          <div className="tw-sync-banner">
            <p>{syncWarning || 'Wallet not synced for on-chain trading — bots cannot sign transactions.'}</p>
            <form onSubmit={resyncWallet} className="tw-sync-form">
              <input
                type="password"
                value={syncPassword}
                onChange={(e) => setSyncPassword(e.target.value)}
                placeholder="Enter password to sync wallet"
                autoComplete="current-password"
                required
              />
              <button type="submit" className="tw-btn primary" disabled={syncLoading}>
                {syncLoading ? 'Syncing…' : 'Sync wallet'}
              </button>
            </form>
          </div>
        )}

        <nav className="tw-tabs">
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

        <div className="tw-dash-content">
          {tab === 'overview' && (
            <div className="tw-overview">
              <div className="tw-overview-grid">
                <div className="tw-terminal tw-dash-term tw-hud">
                  <HudCorners />
                  <div className="tw-terminal-bar">
                    <span /><span /><span />
                    <p>tickwire://engine · {engineRunning ? 'live' : 'offline'}</p>
                    <em className="tw-term-live">{engineRunning ? 'LIVE' : 'IDLE'}</em>
                  </div>
                  <div className="tw-terminal-body">
                    {terminalLines.map((line) => (
                      <div key={`${line.time}-${line.msg}`} className={`tw-terminal-line ${line.type}`}>
                        <span className="t">{line.time}</span>
                        <span className="a">{line.agent}</span>
                        <span className="m">{line.msg}</span>
                      </div>
                    ))}
                    <span className="tw-terminal-cursor">▊</span>
                  </div>
                </div>

                <div className="tw-side-stack">
                  <article className="tw-panel accent tw-hud">
                    <HudCorners />
                    <span className="tw-panel-tag">// ENGINE_STATUS</span>
                    {diagError ? (
                      <p className="tw-panel-text">Could not load: {diagError}</p>
                    ) : diagnostics ? (
                      <>
                        <h3>{diagnostics.engineRunning ? 'Engine running' : 'Engine offline'}</h3>
                        <p className="tw-panel-text">
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
                      <p className="tw-panel-text">Loading engine status…</p>
                    )}
                    <button type="button" className="tw-link-btn" onClick={() => setTab('engine')}>View details →</button>
                  </article>

                  <article className="tw-panel tw-hud">
                    <HudCorners />
                    <span className="tw-panel-tag">// QUICK_ACTIONS</span>
                    <div className="tw-quick">
                      <button type="button" className="tw-btn primary" onClick={() => { setForm(emptyForm()); setShowCreate(true); setTab('bots'); }}>
                        + New bot
                      </button>
                      <Link to="/live" className="tw-btn ghost">View floor</Link>
                      <button type="button" className="tw-btn ghost subtle" onClick={() => setTab('wallet')}>
                        Wallet details
                      </button>
                    </div>
                  </article>

                  <article className="tw-panel tw-hud">
                    <HudCorners />
                    <span className="tw-panel-tag">// FLEET</span>
                    <h3>{bots.length ? `${activeCount} of ${bots.length} trading` : 'No bots yet'}</h3>
                    <p className="tw-panel-text">
                      {bots.length
                        ? 'Active bots scan Ethereum stock trackers and execute on Uniswap V3.'
                        : 'Create your first bot to start automated stock-token trading.'}
                    </p>
                    {bots.length > 0 && (
                      <button type="button" className="tw-link-btn" onClick={() => setTab('bots')}>Manage bots →</button>
                    )}
                  </article>
                </div>
              </div>

              {bots.length > 0 && (
                <section className="tw-fleet">
                  <div className="tw-section-head">
                    <p className="tw-eyebrow">// ACTIVE_FLEET</p>
                    <h2>Your trading bots</h2>
                  </div>
                  <div className="tw-bot-grid compact">
                    {bots.slice(0, 3).map(renderBotCard)}
                  </div>
                  {bots.length > 3 && (
                    <button type="button" className="tw-link-btn tw-see-all" onClick={() => setTab('bots')}>
                      View all {bots.length} bots →
                    </button>
                  )}
                </section>
              )}

              {!bots.length && (
                <div className="tw-empty">
                  <h3>No bots yet</h3>
                  <p>Create a named bot, fund your wallet with ETH on {BRAND.chainName}, then hit Start to trade on-chain.</p>
                  <button type="button" className="tw-btn primary" onClick={() => { setForm(emptyForm()); setShowCreate(true); setTab('bots'); }}>
                    Create your first bot
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'bots' && (
            <div className="tw-bots-panel">
              <div className="tw-panel-head">
                <div>
                  <p className="tw-eyebrow">// FLEET_MGMT</p>
                  <h2>My bots</h2>
                </div>
                {!showCreate && (
                  <button type="button" className="tw-btn primary" onClick={() => { setForm(emptyForm()); setShowCreate(true); }}>
                    + Create bot
                  </button>
                )}
              </div>

              {renderCreatePanel()}

              {!bots.length && !showCreate && (
                <div className="tw-empty">
                  <h3>No bots yet</h3>
                  <p>Create a named bot, fund your wallet, then hit Start to trade on-chain.</p>
                  <button type="button" className="tw-btn primary" onClick={() => setShowCreate(true)}>Create bot</button>
                </div>
              )}

              {bots.length > 0 && (
                <div className="tw-bot-grid">
                  {bots.map(renderBotCard)}
                </div>
              )}

              <p className="tw-footer-link"><Link to="/live">View the public trading floor →</Link></p>
            </div>
          )}

          {tab === 'engine' && (
            <div className="tw-engine-panel">
              <div className="tw-panel-head">
                <div>
                  <p className="tw-eyebrow">// DIAGNOSTICS</p>
                  <h2>System diagnostics</h2>
                </div>
                <span className="tw-build-stamp">
                  Build {typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : 'local'}
                </span>
              </div>

              <div className="tw-terminal tw-dash-term large tw-hud">
                <HudCorners />
                <div className="tw-terminal-bar">
                  <span /><span /><span />
                  <p>tickwire://engine · diagnostics</p>
                  <em className="tw-term-live">{engineRunning ? 'LIVE' : 'IDLE'}</em>
                </div>
                <div className="tw-terminal-body">
                  {diagError ? (
                    <div className="tw-terminal-line info">
                      <span className="t">ERR</span>
                      <span className="a">SYSTEM</span>
                      <span className="m">Could not load engine status: {diagError}</span>
                    </div>
                  ) : diagnostics ? (
                    <>
                      <div className="tw-terminal-line info">
                        <span className="t">SYS</span>
                        <span className="a">ENGINE</span>
                        <span className="m">
                          Status: {diagnostics.engineRunning ? 'running' : 'offline'} · Mode: {engineMode}
                        </span>
                      </div>
                      <div className="tw-terminal-line info">
                        <span className="t">SYS</span>
                        <span className="a">WALLET</span>
                        <span className="m">
                          Synced: {diagnostics.tradingReady ? 'yes' : 'no — sync below'} · Address: {shortAddr(user?.walletAddress)}
                        </span>
                      </div>
                      <div className="tw-terminal-line buy">
                        <span className="t">SYS</span>
                        <span className="a">SCAN</span>
                        <span className="m">
                          Stock tokens in range: {diagnostics.candidatesInRange ?? '—'}
                          {diagnostics.stockDiscovery?.tradableCount != null && ` · ${diagnostics.stockDiscovery.tradableCount} tradable`}
                          {diagnostics.stockDiscovery?.poolSize != null && ` of ${diagnostics.stockDiscovery.poolSize} listed`}
                        </span>
                      </div>
                      {diagnostics.botStatus?.map((b) => (
                        <div key={b.id} className={`tw-terminal-line ${b.isActive ? 'buy' : 'info'}`}>
                          <span className="t">BOT</span>
                          <span className="a">{(b.name || 'unnamed').slice(0, 8).toUpperCase()}</span>
                          <span className="m">
                            {b.lastStatus ? b.lastStatus.reason : b.isActive ? 'scanning for trades…' : 'stopped'}
                          </span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="tw-terminal-line info">
                      <span className="m">Loading engine status…</span>
                    </div>
                  )}
                  <span className="tw-terminal-cursor">▊</span>
                </div>
              </div>

              {(!tradingReady || syncWarning) && (
                <article className="tw-panel accent">
                  <span className="tw-panel-tag">Wallet sync required</span>
                  <p className="tw-panel-text">
                    {syncWarning || 'Your wallet keys are not synced to the server. Bots cannot sign on-chain transactions until you sync.'}
                  </p>
                  <form onSubmit={resyncWallet} className="tw-sync-form">
                    <input
                      type="password"
                      value={syncPassword}
                      onChange={(e) => setSyncPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button type="submit" className="tw-btn primary" disabled={syncLoading}>
                      {syncLoading ? 'Syncing…' : 'Sync wallet for trading'}
                    </button>
                  </form>
                </article>
              )}
            </div>
          )}

          {tab === 'wallet' && (
            <div className="tw-wallet-panel">
              <div className="tw-panel-head">
                <div>
                  <p className="tw-eyebrow">// ACCOUNT</p>
                  <h2>Wallet</h2>
                </div>
              </div>

              <div className="tw-wallet-hero tw-hud">
                <HudCorners />
                <span className="tw-wallet-label">AVAILABLE_BALANCE</span>
                <div className="tw-balance large">
                  <span className="tw-balance-val">{balance != null ? balance.toFixed(6) : '—'}</span>
                  <span className="tw-balance-unit">ETH</span>
                </div>
                <p className="tw-panel-text">On {BRAND.chainName} · used to buy tokenized stocks via Uniswap V3</p>
              </div>

              <div className="tw-wallet-grid">
                <article className="tw-panel tw-hud">
                  <HudCorners />
                  <span className="tw-panel-tag">// ADDRESS</span>
                  <code className="tw-full-addr">{user?.walletAddress}</code>
                  <button type="button" className="tw-btn ghost" onClick={copyWallet}>
                    {copied ? 'Copied!' : 'Copy full address'}
                  </button>
                </article>

                <article className="tw-panel tw-hud">
                  <HudCorners />
                  <span className="tw-panel-tag">// ACCOUNT</span>
                  <ul className="tw-info-list">
                    <li><span>Chain</span><strong>{BRAND.chainName}</strong></li>
                    <li><span>Native token</span><strong>{BRAND.nativeSymbol}</strong></li>
                    <li><span>Trading ready</span><strong className={tradingReady ? 'ok' : 'warn'}>{tradingReady ? 'Yes' : 'No — sync required'}</strong></li>
                    <li><span>Created</span><strong>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</strong></li>
                  </ul>
                </article>
              </div>

              <article className="tw-panel tw-hud">
                <HudCorners />
                <span className="tw-panel-tag">// FUND</span>
                <p className="tw-panel-text">
                  Send ETH to your address above on <strong>{BRAND.chainName}</strong> (chain ID {CHAIN.chainId}) — Ethereum mainnet, not an L2.
                  L1 gas is expensive; keep a reserve for swaps.
                </p>
                <div className="tw-wallet-actions">
                  <button type="button" className="tw-btn ghost" onClick={addEthereumNetwork}>
                    Switch MetaMask to Ethereum
                  </button>
                  <Link to="/docs" className="tw-link-btn">Read setup docs →</Link>
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
