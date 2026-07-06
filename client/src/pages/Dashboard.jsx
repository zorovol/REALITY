import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import { getSession, clearSession, getWalletBalance } from '../lib/walletAuth.js';
import {
  BOT_TYPES, defaultTradingRules, listBots, createBot, updateBot, deleteBot,
} from '../lib/localBots.js';
import { syncFloorBot, unpublishFloorBot } from '../lib/floorApi.js';
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

  const load = useCallback(async () => {
    const session = getSession();
    if (!session) {
      nav('/login');
      return;
    }
    setUser(session);
    setBots(listBots(session.walletAddress));
    try {
      const bal = await getWalletBalance(session.walletAddress);
      setBalance(bal);
    } catch {
      setBalance(null);
    }
    setLoading(false);
  }, [nav]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  function logout() {
    clearSession();
    nav('/');
  }

  async function createBotSubmit(e) {
    e.preventDefault();
    setError('');
    if (!user) return;
    const trimmed = form.name.trim();
    if (trimmed.length < 2) {
      return setError('Name your bot (min 2 characters) — it appears on the public trading floor.');
    }
    try {
      const bot = createBot(user.walletAddress, { ...form, name: trimmed });
      await syncFloorBot(bot, user.walletAddress);
      setForm(emptyForm());
      setShowCreate(false);
      setBots(listBots(user.walletAddress));
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleBot(bot) {
    if (!user) return;
    const updated = updateBot(user.walletAddress, bot.id, { isActive: !bot.isActive });
    if (updated) await syncFloorBot(updated, user.walletAddress).catch(() => {});
    setBots(listBots(user.walletAddress));
  }

  async function saveBotName(bot, name) {
    if (!user) return;
    const trimmed = name.trim();
    const updated = updateBot(user.walletAddress, bot.id, { name: trimmed });
    if (updated) await syncFloorBot(updated, user.walletAddress).catch(() => {});
    setBots(listBots(user.walletAddress));
  }

  async function removeBot(id) {
    if (!user || !confirm('Delete this bot permanently?')) return;
    await unpublishFloorBot(id, user.walletAddress).catch(() => {});
    deleteBot(user.walletAddress, id);
    setBots(listBots(user.walletAddress));
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
            <p className="dash-hint">Send SOL to this address to fund bot trades.</p>
          </div>

          <div className="dash-sidebar-stats">
            <div><span>{bots.length}</span><small>Bots</small></div>
            <div><span>{activeCount}</span><small>Active</small></div>
            <div><span>{onFloorCount}</span><small>On floor</small></div>
          </div>

          <button type="button" className="dash-logout" onClick={logout}>Log out</button>
        </aside>

        <main className="dash-main">
          <header className="dash-header">
            <div>
              <h1>Trading bots</h1>
              <p>Name each bot to show it on the public <Link to="/live">trading floor</Link>.</p>
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
              <p>Create a named bot — it goes live on the trading floor for everyone to see.</p>
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
                      {bot.isActive ? '● LIVE' : '○ STOPPED'}
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
                      {bot.isActive ? 'Stop' : 'Start'}
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
