import { Link } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import Character from '../components/Character.jsx';
import { BRAND } from '../config/brand.js';

const BOTS = [
  { id: 'chatgpt', label: 'ChatGPT', color: '#00c805' },
  { id: 'grok', label: 'Grok', color: '#fb7185' },
  { id: 'fable', label: 'Fable', color: '#fbbf24' },
  { id: 'gemini', label: 'Gemini', color: '#a78bfa' },
  { id: 'deepseek', label: 'DeepSeek', color: '#38bdf8' },
];

const TICKER = [
  'ROBINHOOD BOT TRADE',
  'ROBINHOOD CHAIN',
  'UNISWAP EXECUTE',
  'AAPL · NVDA · TSLA · QQQ',
  'AUTO WALLET',
  '5 AI AGENTS',
  '24/7 ENGINE',
  'ENCRYPTED KEYS',
];

const STRATEGIES = [
  { id: 'chatgpt', name: 'ChatGPT', desc: 'New listings — first on fresh stock token pools.', color: '#00c805' },
  { id: 'grok', name: 'Grok', desc: 'Volatility hunter — rides price spikes on-chain.', color: '#fb7185' },
  { id: 'fable', name: 'Fable', desc: 'Chaos mode — random stock picks, story-driven plays.', color: '#fbbf24' },
  { id: 'gemini', name: 'Gemini', desc: 'Blue chips — larger notional at the top of your range.', color: '#a78bfa' },
  { id: 'deepseek', name: 'DeepSeek', desc: 'Value sniper — smallest notional in your band.', color: '#38bdf8' },
];

const TERMINAL_LINES = [
  { time: '04:12:01', agent: 'SNIPER', msg: 'BUY 0.0005 ETH → AAPL', type: 'buy' },
  { time: '04:12:04', agent: 'ENGINE', msg: 'notional $220M · TP +8% · SL -5%', type: 'info' },
  { time: '04:12:18', agent: 'SNIPER', msg: 'SELL +6.2% · tx 0x8f…9mQ', type: 'sell' },
  { time: '04:12:22', agent: 'MOMENTUM', msg: 'scanning 4 stock tokens…', type: 'info' },
  { time: '04:12:25', agent: 'MOMENTUM', msg: 'BUY 0.0005 ETH → NVDA', type: 'buy' },
  { time: '04:12:41', agent: 'MOMENTUM', msg: 'SELL -2.1% · time limit', type: 'sell' },
];

const BENTO = [
  {
    title: 'Zero setup wallet',
    desc: 'Sign up → EVM wallet generated instantly. Your address is your username.',
    span: 'wide',
    icon: '◈',
  },
  {
    title: '5 AI bots',
    desc: 'ChatGPT · Grok · Fable · Gemini · DeepSeek',
    span: 'narrow',
    icon: '⚡',
  },
  {
    title: 'Your rules',
    desc: 'Market cap range, buy size, take profit & stop loss. You configure, the engine executes.',
    span: 'narrow',
    icon: '◎',
  },
  {
    title: 'Fort Knox keys',
    desc: 'Dual-encrypted at rest. Never touch your browser. Server-side execution only.',
    span: 'wide',
    icon: '⛨',
  },
];

export default function Home() {
  return (
    <div className="home-v2">
      <div className="home-v2-bg" aria-hidden="true">
        <div className="home-v2-orb home-v2-orb-a" />
        <div className="home-v2-orb home-v2-orb-b" />
        <div className="home-v2-orb home-v2-orb-c" />
        <div className="home-v2-grid" />
        <div className="home-v2-noise" />
      </div>

      <PlatformNav />

      <div className="home-v2-ticker" aria-hidden="true">
        <div className="home-v2-ticker-track">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={`${t}-${i}`}>{t}<i>◆</i></span>
          ))}
        </div>
      </div>

      <section className="home-v2-hero">
        <div className="home-v2-hero-inner">
          <div className="home-v2-copy">
            <div className="home-v2-live">
              <span className="home-v2-live-dot" />
              {BRAND.name.toUpperCase()} · {BRAND.chainName.toUpperCase()}
            </div>
            <h1>
              <span className="hero-brand-accent">{BRAND.nameParts.accent}</span>
              {BRAND.nameParts.rest} Trading.
              <br />
              <em>On autopilot.</em>
            </h1>
            <p className="home-v2-lead">
              {BRAND.description} No seed phrase. No manual keys. Just fund, configure, and let the engine run.
            </p>
            <div className="home-v2-cta">
              <Link to="/signup" className="home-v2-btn primary">
                Launch your bot
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </Link>
              <Link to="/live" className="home-v2-btn ghost">Trading floor</Link>
              <Link to="/docs" className="home-v2-btn ghost subtle">Docs</Link>
            </div>
            <div className="home-v2-metrics">
              <div><strong>5</strong><span>Strategies</span></div>
              <div><strong>24/7</strong><span>Engine</span></div>
              <div><strong>~3s</strong><span>Trade ticks</span></div>
              <div><strong>100%</strong><span>On-chain</span></div>
            </div>
          </div>

          <div className="home-v2-stage-wrap">
            <div className="home-v2-stage">
              <div className="home-v2-stage-ring" />
              <div className="home-v2-stage-core">
                <img src="/logo.svg" alt={BRAND.name} className="home-v2-logo" />
              </div>
              {BOTS.map((bot, i) => (
                <div
                  key={bot.id}
                  className="home-v2-agent"
                  style={{
                    '--i': i,
                    '--c': bot.color,
                    transform: `rotate(${i * 72}deg) translateY(-130px) rotate(${-i * 72}deg)`,
                  }}
                >
                  <Character id={bot.id} size={56} className="home-v2-agent-char" />
                  <span>{bot.label}</span>
                </div>
              ))}
              <div className="home-v2-stage-badge">Robinhood Chain</div>
            </div>

            <div className="home-v2-terminal" aria-hidden="true">
              <div className="home-v2-terminal-bar">
                <span /><span /><span />
                <p>botforge-engine · live</p>
              </div>
              <div className="home-v2-terminal-body">
                {TERMINAL_LINES.map((line) => (
                  <div key={`${line.time}-${line.msg}`} className={`home-v2-terminal-line ${line.type}`}>
                    <span className="home-v2-terminal-time">{line.time}</span>
                    <span className="home-v2-terminal-agent">{line.agent}</span>
                    <span className="home-v2-terminal-msg">{line.msg}</span>
                  </div>
                ))}
                <span className="home-v2-terminal-cursor">▊</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-v2-strategies">
        <div className="home-v2-strategies-head">
          <p className="home-v2-eyebrow">Pick your edge</p>
          <h2>Five bot types. One engine.</h2>
          <p>ChatGPT, Grok, Fable, Gemini, DeepSeek — same rules, different pick logic.</p>
        </div>
        <div className="home-v2-strategy-grid">
          {STRATEGIES.map((s) => (
            <article key={s.id} className="home-v2-strategy-card" style={{ '--accent': s.color }}>
              <div className="home-v2-strategy-dot" />
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-v2-split">
        <article className="home-v2-split-card">
          <span className="home-v2-split-tag">Your dashboard</span>
          <h3>Personal trading bots</h3>
          <p>Create bots tied to your wallet. Set rules, start/stop anytime, track every trade on your dashboard.</p>
          <Link to="/signup" className="home-v2-link">Create account →</Link>
        </article>
        <article className="home-v2-split-card accent">
          <span className="home-v2-split-tag">Public showcase</span>
          <h3>Community trading floor</h3>
          <p>Name your bot on the dashboard and it appears on the public floor — every user&apos;s bot, live for all to see.</p>
          <Link to="/live" className="home-v2-link">View trading floor →</Link>
        </article>
      </section>

      <section className="home-v2-bento-wrap">
        <h2>Everything you need. Nothing you don&apos;t.</h2>
        <div className="home-v2-bento">
          {BENTO.map((b) => (
            <article key={b.title} className={`home-v2-bento-card ${b.span}`}>
              <span className="home-v2-bento-icon">{b.icon}</span>
              <h3>{b.title}</h3>
              <p>{b.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-v2-flow">
        <h2>Live in 60 seconds</h2>
        <div className="home-v2-steps">
          {['Sign up + password', 'Fund your wallet', 'Create & start bot', 'Watch it run'].map((s, i) => (
            <div key={s} className="home-v2-step">
              <span>{String(i + 1).padStart(2, '0')}</span>
              <p>{s}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="home-v2-final">
        <div className="home-v2-final-glow" aria-hidden="true" />
        <h2>Stop watching. Start trading.</h2>
        <p className="home-v2-final-sub">Free to sign up. Real ETH. Real stock token trades on Robinhood Chain.</p>
        <Link to="/signup" className="home-v2-btn primary large">Create free account</Link>
        <p className="home-v2-disclaimer">Not financial advice. You can lose funds. Trade responsibly.</p>
      </section>

      <footer className="home-v2-footer">
        <Link to="/docs">Docs</Link>
        <Link to="/live">Trading floor</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/login">Log in</Link>
        <span>© {new Date().getFullYear()} {BRAND.fullName}</span>
      </footer>
    </div>
  );
}
