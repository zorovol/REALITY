import { Link } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import Character from '../components/Character.jsx';
import { BRAND } from '../config/brand.js';

const BOTS = [
  { id: 'chatgpt', label: 'ChatGPT', color: '#14f1d9' },
  { id: 'grok', label: 'Grok', color: '#ff63df' },
  { id: 'fable', label: 'Fable', color: '#b8ff42' },
  { id: 'gemini', label: 'Gemini', color: '#8c7bff' },
  { id: 'deepseek', label: 'DeepSeek', color: '#56a8ff' },
];

const TICKER = [
  'AI SCANNER LIVE',
  'PUMP.FUN RADAR',
  'SOLANA EXECUTION',
  'AGENT SWARM ONLINE',
  'SIGNAL → FILL',
  'AUTONOMOUS TRADING',
  '24/7 ON-CHAIN',
  'ENCRYPTED KEYS',
];

const STRATEGIES = [
  { id: 'chatgpt', name: 'ChatGPT', desc: 'Fresh-launch hunter — early on new bonding curves.', color: '#14f1d9' },
  { id: 'grok', name: 'Grok', desc: 'Volatility hunter — tracks momentum spikes.', color: '#ff63df' },
  { id: 'fable', name: 'Fable', desc: 'Chaos agent — explores the long tail of Pumps.', color: '#b8ff42' },
  { id: 'gemini', name: 'Gemini', desc: 'Liquidity agent — favors the upper end of your range.', color: '#8c7bff' },
  { id: 'deepseek', name: 'DeepSeek', desc: 'Low-cap sniper — smallest market caps in your band.', color: '#56a8ff' },
];

const TERMINAL_LINES = [
  { time: '04:12:01', agent: 'SNIPER', msg: 'BUY 0.015 SOL → $PEPE2', type: 'buy' },
  { time: '04:12:04', agent: 'ENGINE', msg: 'mcap $3.8k · TP +8% · SL -5%', type: 'info' },
  { time: '04:12:18', agent: 'SNIPER', msg: 'SELL +6.2% · sig 5xK…9mQ', type: 'sell' },
  { time: '04:12:22', agent: 'MOMENTUM', msg: 'scanning 284 tokens…', type: 'info' },
  { time: '04:12:25', agent: 'MOMENTUM', msg: 'BUY 0.015 SOL → $WOJAK', type: 'buy' },
  { time: '04:12:41', agent: 'MOMENTUM', msg: 'SELL -2.1% · time limit', type: 'sell' },
];

const BENTO = [
  {
    title: 'Zero setup wallet',
    desc: 'Sign up → Solana keypair generated instantly. Your address is your username.',
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
              {BRAND.name.toUpperCase()} · SOLANA MAINNET
            </div>
            <h1>
              Your AI hunts.
              <br />
              <em>You stay in control.</em>
            </h1>
            <p className="home-v2-lead">
              {BRAND.description} Your AI agents scan Pump.fun, follow the rules you set, and execute on Solana.
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
              <div className="home-v2-signal-card signal-a">
                <span>AGENT SWARM</span>
                <strong><i /> 5 ONLINE</strong>
              </div>
              <div className="home-v2-stage-core">
                <img src="/logo.png" alt={BRAND.name} className="home-v2-logo" />
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
              <div className="home-v2-stage-badge">pump.fun</div>
              <div className="home-v2-signal-card signal-b">
                <span>EXECUTION</span>
                <strong>SOLANA <em>↗</em></strong>
              </div>
            </div>

            <div className="home-v2-terminal" aria-hidden="true">
              <div className="home-v2-terminal-bar">
                <span /><span /><span />
                <p>solvanta-agent-swarm · live</p>
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
          <h2>Five AI agents. One execution layer.</h2>
          <p>Every agent sees the same Pump.fun universe. Your rules decide the risk; its selection logic decides the hunt.</p>
        </div>
        <div className="home-v2-strategy-grid">
          {STRATEGIES.map((s) => (
            <article key={s.id} className="home-v2-strategy-card" style={{ '--accent': s.color }}>
              <div className="home-v2-strategy-dot" />
              <span className="home-v2-agent-id">AI-0{STRATEGIES.indexOf(s) + 1}</span>
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
          <h2>AI trading, with your guardrails.</h2>
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
        <p className="home-v2-final-sub">Free to sign up. Real SOL. Real pump.fun trades.</p>
        <Link to="/signup" className="home-v2-btn primary large">Create free account</Link>
        <p className="home-v2-disclaimer">Not financial advice. You can lose funds. Trade responsibly.</p>
      </section>

      <section className="home-v2-brand-kit">
        <div className="home-v2-brand-kit-head">
          <p className="home-v2-eyebrow">Brand kit</p>
          <h2>Rep {BRAND.name}</h2>
          <p>Grab the official PFP and banner — free to use for posts, communities, and profiles.</p>
        </div>
        <div className="home-v2-brand-kit-grid">
          <article className="home-v2-brand-card">
            <img src="/social/solvanta-pfp.png" alt={`${BRAND.name} profile picture`} loading="lazy" />
            <div className="home-v2-brand-card-row">
              <div>
                <h3>Profile picture</h3>
                <span>1024 × 1024 · PNG</span>
              </div>
              <a href="/social/solvanta-pfp.png" download="solvanta-pfp.png" className="home-v2-btn ghost">
                Download
              </a>
            </div>
          </article>
          <article className="home-v2-brand-card wide">
            <img src="/social/solvanta-banner.png" alt={`${BRAND.name} banner`} loading="lazy" />
            <div className="home-v2-brand-card-row">
              <div>
                <h3>Banner</h3>
                <span>1536 × 1024 · PNG</span>
              </div>
              <a href="/social/solvanta-banner.png" download="solvanta-banner.png" className="home-v2-btn ghost">
                Download
              </a>
            </div>
          </article>
        </div>
      </section>

      <footer className="home-v2-footer">
        <Link to="/docs">Docs</Link>
        <Link to="/live">Trading floor</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/login">Log in</Link>
        <span>© {BRAND.name}</span>
      </footer>
    </div>
  );
}
