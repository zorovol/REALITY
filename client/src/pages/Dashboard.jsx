import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const BOT_LABELS = {
  sniper: 'Sniper — new tokens',
  momentum: 'Momentum — volume spikes',
  lowcap: 'Low cap — smallest mcap',
  whale: 'Whale — high activity',
  meme: 'Meme — trending picks',
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

  async function load() {
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
  }

  useEffect(() => { load(); }, []);

  async function logout() {
    await api.logout();
    nav('/login');
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
    if (!confirm('Delete this bot?')) return;
    await api.deleteBot(id);
    await load();
  }

  function ruleField(key, label) {
    return (
      <label key={key}>
        {label}
        <input
          type="number"
          step="any"
          value={form.tradingRules[key] ?? defaults?.[key] ?? ''}
          onChange={(e) => setForm({
            ...form,
            tradingRules: { ...form.tradingRules, [key]: Number(e.target.value) },
          })}
        />
      </label>
    );
  }

  if (loading) return <div className="platform-page"><p className="platform-loading">Loading dashboard…</p></div>;

  return (
    <div className="platform-dash">
      <header className="platform-dash-head">
        <div>
          <h1>Trading Dashboard</h1>
          <p className="platform-sub">Automated pump.fun bots on your wallet</p>
        </div>
        <div className="platform-dash-actions">
          <button type="button" className="platform-btn secondary" onClick={logout}>Log out</button>
          <button type="button" className="platform-btn" onClick={() => setShowCreate(true)}>Create Bot</button>
        </div>
      </header>

      <section className="platform-wallet-card">
        <h2>Your Wallet</h2>
        <code className="platform-wallet">{user?.walletAddress}</code>
        <p className="platform-balance">
          Balance: <strong>{balance != null ? `${balance.toFixed(4)} SOL` : '—'}</strong>
        </p>
        <p className="platform-hint">Fund this address with SOL to enable bot trading. Private keys never leave the server.</p>
      </section>

      {showCreate && (
        <section className="platform-card platform-create">
          <h2>Create Bot</h2>
          <form onSubmit={createBot} className="platform-form platform-form-grid">
            <label>
              Bot type
              <select value={form.botType} onChange={(e) => setForm({ ...form, botType: e.target.value })}>
                {types.map((t) => <option key={t} value={t}>{BOT_LABELS[t] ?? t}</option>)}
              </select>
            </label>
            {ruleField('minMarketCap', 'Min market cap ($)')}
            {ruleField('maxMarketCap', 'Max market cap ($)')}
            {ruleField('buyAmountSol', 'Buy amount (SOL)')}
            {ruleField('takeProfitPercent', 'Take profit (%)')}
            {ruleField('stopLossPercent', 'Stop loss (%)')}
            {error && <p className="platform-error">{error}</p>}
            <div className="platform-form-actions">
              <button type="button" className="platform-btn secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="platform-btn">Save Bot</button>
            </div>
          </form>
        </section>
      )}

      <section className="platform-bots">
        <h2>Your Bots ({bots.length})</h2>
        {!bots.length && <p className="platform-hint">No bots yet. Create one to start automated trading.</p>}
        <div className="platform-bot-grid">
          {bots.map((bot) => (
            <article key={bot.id} className={`platform-bot-card ${bot.isActive ? 'active' : ''}`}>
              <header>
                <span className="platform-bot-type">{bot.botType}</span>
                <span className={`platform-bot-status ${bot.isActive ? 'on' : 'off'}`}>
                  {bot.isActive ? 'ACTIVE' : 'STOPPED'}
                </span>
              </header>
              <ul className="platform-bot-rules">
                <li>MCap: ${bot.tradingRules.minMarketCap}–${bot.tradingRules.maxMarketCap}</li>
                <li>Buy: {bot.tradingRules.buyAmountSol} SOL</li>
                <li>TP: {bot.tradingRules.takeProfitPercent}% · SL: {bot.tradingRules.stopLossPercent}%</li>
              </ul>
              {bot.position && (
                <p className="platform-position">Holding ${bot.position.symbol} @ ~${Math.round(bot.position.entryMcap)} mcap</p>
              )}
              <div className="platform-bot-actions">
                <button type="button" className="platform-btn" onClick={() => toggleBot(bot)}>
                  {bot.isActive ? 'Stop' : 'Start'}
                </button>
                <button type="button" className="platform-btn danger" onClick={() => removeBot(bot.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <p className="platform-footer-link"><Link to="/">← Back to trading floor</Link></p>
    </div>
  );
}
