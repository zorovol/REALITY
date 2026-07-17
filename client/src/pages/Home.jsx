import { Link } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import { BRAND } from '../config/brand.js';

const TICKER = [
  'NVDAon', 'TSLAon', 'AAPLon', 'SPYon', 'QQQon', 'GOOGLon', 'SPCXon', 'MSFTon',
  'ETH', 'UNISWAP V3', 'AUTOPILOT', 'TICKWIRE',
];

const STRATEGIES = [
  { id: 'chatgpt', name: 'ChatGPT', desc: 'Volume leader — most-traded stock trackers.' },
  { id: 'grok', name: 'Grok', desc: 'Turnover hunter — hottest on-chain activity.' },
  { id: 'fable', name: 'Fable', desc: 'Chaos mode — random stock picks.' },
  { id: 'gemini', name: 'Gemini', desc: 'Liquidity first — deepest Uniswap pools.' },
  { id: 'deepseek', name: 'DeepSeek', desc: 'Thin pools — smaller liquidity bands.' },
];

export default function Home() {
  return (
    <div className="tw">
      <div className="tw-bg" aria-hidden="true">
        <div className="tw-scanlines" />
        <div className="tw-grid" />
      </div>

      <PlatformNav />

      <section className="tw-hero">
        <div className="tw-ticker" aria-hidden="true">
          <div className="tw-ticker-track">
            {[...TICKER, ...TICKER, ...TICKER].map((t, i) => (
              <span key={`${t}-${i}`}>{t}</span>
            ))}
          </div>
        </div>

        <div className="tw-hero-inner">
          <p className="tw-kicker">{BRAND.kicker}</p>
          <h1 className="tw-brand" aria-label={BRAND.name}>
            <span className="tw-brand-accent">{BRAND.nameParts.accent}</span>
            <span className="tw-brand-rest">{BRAND.nameParts.rest}</span>
          </h1>
          <p className="tw-headline">Stocks. On Ethereum. On autopilot.</p>
          <p className="tw-lead">
            Tokenized stock trackers on Ethereum mainnet — bought and sold with ETH through Uniswap V3.
            Not brokerage shares. Real L1 gas. Real positions.
          </p>
          <div className="tw-cta">
            <Link to="/signup" className="tw-btn primary">Launch bots</Link>
            <Link to="/docs" className="tw-btn ghost">How it works</Link>
          </div>
        </div>
      </section>

      <section className="tw-section">
        <div className="tw-section-head">
          <p className="tw-eyebrow">Strategies</p>
          <h2>Five agents. One wire.</h2>
        </div>
        <div className="tw-strat-row">
          {STRATEGIES.map((s) => (
            <article key={s.id} className="tw-strat">
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tw-section tw-flow">
        <h2>Live in under a minute</h2>
        <ol className="tw-steps">
          <li><span>01</span>Sign up + password</li>
          <li><span>02</span>Fund with ETH on Ethereum</li>
          <li><span>03</span>Create & start a bot</li>
          <li><span>04</span>Watch Uniswap fills</li>
        </ol>
      </section>

      <section className="tw-final">
        <h2>Stop watching charts. Wire the desk.</h2>
        <p>Free to sign up. Real ETH. Tokenized stocks via Uniswap V3 on Ethereum.</p>
        <Link to="/signup" className="tw-btn primary">Create account</Link>
        <p className="tw-disclaimer">
          Not financial advice. These are tokenized trackers, not brokerage shares. You can lose funds. L1 gas applies.
        </p>
      </section>

      <footer className="tw-footer">
        <Link to="/docs">Docs</Link>
        <Link to="/live">Floor</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/login">Log in</Link>
        <span>© {new Date().getFullYear()} {BRAND.fullName}</span>
      </footer>
    </div>
  );
}
