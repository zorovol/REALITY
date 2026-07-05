import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import { api } from '../lib/api.js';

const BOT_META = {
  sniper: { label: 'Sniper', desc: 'Prioritizes newest tokens', color: '#34d399' },
  momentum: { label: 'Momentum', desc: 'Fast volume & volatility', color: '#22d3ee' },
  lowcap: { label: 'Low Cap', desc: 'Smallest market caps', color: '#fbbf24' },
  whale: { label: 'Whale', desc: 'High activity tokens', color: '#a78bfa' },
  meme: { label: 'Meme', desc: 'Trending random picks', color: '#fb7185' },
};

export default function Dashboard() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [bots, setBots] = useState([]);
  const [types, setTypes] = useState([]);
  const [defaults, setDefaults] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ botType: 'sniper', tradingRules: {} });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, botRes, typeRes, bal] = await Promise.all([
        api.me(),
        api.listBots(),
        api.botTypes(),
        api.walletBalance().catch(() => ({ balanceSol: null })),
      ]);
      setUser(me);
      setBots(botRes.bots);
      setTypes(typeRes.types);
      setDefaults(typeRes.defaultRules);
      setForm((f) => ({ ...f, tradingRules: typeRes.defaultRules }));
      setBalance(bal.balanceSol);
    } catch {
      nav('/login');
    } finally {
      setLoading(false);
    }
  }, [nav]);

  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  async function logout() {
    await api.logout();
    nav('/');
  }

  async function createBot(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createBot(form);
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleBot(bot) {
    if (bot.isActive) await api.stopBot(bot.id);
    else await api.startBot(bot.id);
    await load();
  }

  async function removeBot(id) {
    if (!confirm('Delete this bot permanently?')) return;
    await api.deleteBot(id);
    await load();
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
          value={form.tradingRules[key] ?? defaults?.[key] ?? ''}
          onChange={(e) => setForm({
            ...form,
            tradingRules: { ...form.tradingRules, [key]: Number(e.target.value) },
          })}
        />
      </label>
    );
  }

  const activeCount = bots.filter((b) => b.isActive).length;

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
          </div>

          <button type="button" className="dash-logout" onClick={logout}>Log out</button>
        </aside>

        <main className="dash-main">
          <header className="dash-header">
            <div>
              <h1>Trading bots</h1>
              <p>Configure automated pump.fun scalpers on your wallet.</p>
            </div>
            <button type="button" className="home-btn primary" onClick={() => setShowCreate(true)}>
              + Create bot
            </button>
          </header>

          {showCreate && (
            <section className="dash-create-panel">
              <div className="dash-create-head">
                <h2>New bot</h2>
                <button type="button" className="dash-close" onClick={() => setShowCreate(false)}>×</button>
              </div>

              <div className="dash-type-grid">
                {types.map((t) => {
                  const meta = BOT_META[t] ?? { label: t, desc: '', color: '#94a3b8' };
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`dash-type-card ${form.botType === t ? 'selected' : ''}`}
                      style={{ '--type-color': meta.color }}
                      onClick={() => setForm({ ...form, botType: t })}
                    >
                      <strong>{meta.label}</strong>
                      <span>{meta.desc}</span>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={createBot} className="dash-rules-form">
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
                  <button type="submit" className="home-btn primary">Create bot</button>
                </div>
              </form>
            </section>
          )}

          {!bots.length && !showCreate && (
            <div className="dash-empty">
              <h3>No bots yet</h3>
              <p>Create your first bot to start automated trading on pump.fun.</p>
              <button type="button" className="home-btn primary" onClick={() => setShowCreate(true)}>Create bot</button>
            </div>
          )}

          <div className="dash-bot-grid">
            {bots.map((bot) => {
              const meta = BOT_META[bot.botType] ?? { label: bot.botType, color: '#94a3b8' };
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

                  <ul className="dash-bot-rules">
                    <li><strong>MCap</strong> ${bot.tradingRules.minMarketCap?.toLocaleString()} – ${bot.tradingRules.maxMarketCap?.toLocaleString()}</li>
                    <li><strong>Buy</strong> {bot.tradingRules.buyAmountSol} SOL</li>
                    <li><strong>TP / SL</strong> {bot.tradingRules.takeProfitPercent}% / {bot.tradingRules.stopLossPercent}%</li>
                  </ul>

                  {bot.position && (
                    <div className="dash-position">
                      Holding <strong>${bot.position.symbol}</strong>
                      {bot.position.entryMcap && ` · ~$${Math.round(bot.position.entryMcap)} mcap`}
                    </div>
                  )}

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

          <p className="dash-footer-link"><Link to="/live">Watch the live AI trading floor →</Link></p>
        </main>
      </div>
    </div>
  );
}
