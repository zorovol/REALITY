import { Link } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import Character from '../components/Character.jsx';

const BOTS = ['chatgpt', 'grok', 'fable', 'gemini', 'deepseek'];

const FEATURES = [
  {
    title: 'Auto wallet on signup',
    desc: 'A Solana wallet is generated instantly. Your address is your username — no seed phrase to manage.',
  },
  {
    title: '5 bot strategies',
    desc: 'Sniper, momentum, low cap, whale follower, and meme rotation — each picks tokens differently.',
  },
  {
    title: 'pump.fun scalping',
    desc: 'Bots scan bonding-curve coins, filter by market cap, and execute fast buy/sell on Solana mainnet.',
  },
  {
    title: 'Server-side security',
    desc: 'Private keys encrypted at rest. Never sent to your browser. Decrypted only during trades.',
  },
];

const STEPS = [
  'Sign up with a password',
  'Fund your auto-generated wallet',
  'Create a bot and set your rules',
  'Start it — backend trades 24/7',
];

export default function Home() {
  return (
    <div className="home">
      <div className="home-bg" aria-hidden="true">
        <div className="home-bg-grid" />
        <div className="home-bg-glow" />
      </div>

      <PlatformNav />

      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-eyebrow">Solana · pump.fun · Automated</p>
          <h1>
            AI-powered trading bots
            <span> on autopilot</span>
          </h1>
          <p className="home-lead">
            Sign up, get a wallet, create a bot, and let the backend scalp memecoins while you watch the live AI trading floor.
          </p>
          <div className="home-cta-row">
            <Link to="/signup" className="home-btn primary">Get started free</Link>
            <Link to="/live" className="home-btn secondary">Watch live floor</Link>
          </div>
          <p className="home-disclaimer">Real on-chain trading. Not financial advice.</p>
        </div>

        <div className="home-hero-visual">
          <div className="home-bot-ring">
            {BOTS.map((id) => (
              <Character key={id} id={id} size={52} className="home-bot-avatar" />
            ))}
          </div>
          <div className="home-stat-card">
            <span className="home-stat-label">Tick speed</span>
            <span className="home-stat-val">~3s</span>
          </div>
          <div className="home-stat-card home-stat-card-2">
            <span className="home-stat-label">Target mcap</span>
            <span className="home-stat-val">~$4k</span>
          </div>
        </div>
      </section>

      <section className="home-section">
        <h2>How it works</h2>
        <ol className="home-steps">
          {STEPS.map((step, i) => (
            <li key={step}>
              <span className="home-step-num">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section">
        <h2>Built for speed & security</h2>
        <div className="home-features">
          {FEATURES.map((f) => (
            <article key={f.title} className="home-feature-card">
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-cta-banner">
        <h2>Ready to deploy your first bot?</h2>
        <p>Create an account in under a minute.</p>
        <Link to="/signup" className="home-btn primary">Sign up now</Link>
      </section>

      <footer className="home-footer">
        <Link to="/live">Live trading floor</Link>
        <Link to="/login">Log in</Link>
        <span>© GPTGrokGeminiDeepSeekFable</span>
      </footer>
    </div>
  );
}
