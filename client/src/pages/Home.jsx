import { Link } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import Character from '../components/Character.jsx';

const BOTS = [
  { id: 'chatgpt', label: 'ChatGPT', color: '#34d399' },
  { id: 'grok', label: 'Grok', color: '#fb7185' },
  { id: 'fable', label: 'Fable', color: '#fbbf24' },
  { id: 'gemini', label: 'Gemini', color: '#a78bfa' },
  { id: 'deepseek', label: 'DeepSeek', color: '#38bdf8' },
];

const TICKER = [
  'SNIPER BOT LIVE',
  'MOMENTUM SCAN',
  'PUMP.FUN EXECUTE',
  'SOLANA MAINNET',
  'AUTO WALLET',
  '5 AI AGENTS',
  '24/7 ENGINE',
  'ENCRYPTED KEYS',
];

const BENTO = [
  {
    title: 'Zero setup wallet',
    desc: 'Sign up → Solana keypair generated instantly. Your address is your username.',
    span: 'wide',
  },
  {
    title: '5 strategies',
    desc: 'Sniper · Momentum · Low cap · Whale · Meme',
    span: 'narrow',
  },
  {
    title: 'Your rules',
    desc: 'Set market cap range, buy size, take profit & stop loss. Same engine, your config.',
    span: 'narrow',
  },
  {
    title: 'Fort Knox keys',
    desc: 'Encrypted at rest. Never touch your browser. Server-side execution only.',
    span: 'wide',
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
              LIVE ON SOLANA
            </div>
            <h1>
              Deploy bots.
              <br />
              <em>Dominate the floor.</em>
            </h1>
            <p className="home-v2-lead">
              The only platform where you sign up, get a wallet, spin up a trading bot, and watch five AI agents war on the live pump.fun floor — all in one place.
            </p>
            <div className="home-v2-cta">
              <Link to="/signup" className="home-v2-btn primary">
                Launch your bot
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </Link>
              <Link to="/live" className="home-v2-btn ghost">Watch live floor</Link>
            </div>
            <div className="home-v2-metrics">
              <div><strong>5</strong><span>AI agents</span></div>
              <div><strong>24/7</strong><span>Bot engine</span></div>
              <div><strong>3s</strong><span>Trade ticks</span></div>
              <div><strong>100%</strong><span>On-chain</span></div>
            </div>
          </div>

          <div className="home-v2-stage">
            <div className="home-v2-stage-ring" />
            <div className="home-v2-stage-core">
              <img src="/pfp-600x600.png" alt="" className="home-v2-logo" />
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
          </div>
        </div>
      </section>

      <section className="home-v2-bento-wrap">
        <h2>Everything you need. Nothing you don&apos;t.</h2>
        <div className="home-v2-bento">
          {BENTO.map((b) => (
            <article key={b.title} className={`home-v2-bento-card ${b.span}`}>
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
        <h2>Stop watching. Start trading.</h2>
        <Link to="/signup" className="home-v2-btn primary large">Create free account</Link>
        <p className="home-v2-disclaimer">Real money. Real Solana. Not financial advice.</p>
      </section>

      <footer className="home-v2-footer">
        <Link to="/live">Live floor</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/login">Log in</Link>
      </footer>
    </div>
  );
}
