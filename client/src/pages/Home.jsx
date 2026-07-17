import { Link } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import { BRAND } from '../config/brand.js';

const TICKER = [
  'NVDAon', 'TSLAon', 'AAPLon', 'SPYon', 'QQQon', 'GOOGLon', 'SPCXon',
  'ETH', 'UNISWAP', 'AUTOPILOT',
];

const STRATEGIES = [
  { id: 'chatgpt', name: 'ChatGPT', desc: 'Chases the most-traded stock trackers.' },
  { id: 'grok', name: 'Grok', desc: 'Hunts hottest on-chain turnover.' },
  { id: 'fable', name: 'Fable', desc: 'Random picks across the board.' },
  { id: 'gemini', name: 'Gemini', desc: 'Deepest Uniswap liquidity first.' },
  { id: 'deepseek', name: 'DeepSeek', desc: 'Smaller pools, tighter bands.' },
];

export default function Home() {
  return (
    <div className="tw">
      <div className="tw-bg" aria-hidden="true">
        <div className="tw-wash" />
        <div className="tw-chart" />
      </div>

      <PlatformNav />

      <section className="tw-hero">
        <div className="tw-ticker" aria-hidden="true">
          <div className="tw-ticker-track">
            {[...TICKER, ...TICKER, ...TICKER].map((t, i) => (
              <span key={`${t}-${i}`}>{t}<i>·</i></span>
            ))}
          </div>
        </div>

        <div className="tw-hero-inner">
          <p className="tw-live"><span className="tw-live-dot" /> Live on Ethereum</p>
          <h1 className="tw-brand" aria-label={BRAND.name}>
            <span className="tw-brand-accent">{BRAND.nameParts.accent}</span>
            <span className="tw-brand-rest">{BRAND.nameParts.rest}</span>
          </h1>
          <p className="tw-headline">Stocks on autopilot.</p>
          <p className="tw-lead">
            Auto-trade tokenized stocks with ETH on Uniswap. Sign up, fund, and let the bots run.
          </p>
          <div className="tw-cta">
            <Link to="/signup" className="tw-btn primary">Get started</Link>
            <Link to="/docs" className="tw-btn ghost">Docs</Link>
          </div>
        </div>
      </section>

      <section className="tw-section">
        <div className="tw-section-head">
          <p className="tw-eyebrow">Strategies</p>
          <h2>Five bots. One engine.</h2>
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
        <p className="tw-eyebrow">Setup</p>
        <h2>Trading in four steps</h2>
        <ol className="tw-steps">
          <li><span>01</span>Create account</li>
          <li><span>02</span>Fund with ETH</li>
          <li><span>03</span>Start a bot</li>
          <li><span>04</span>Watch fills</li>
        </ol>
      </section>

      <section className="tw-final">
        <h2>Ready when you are.</h2>
        <p>Real ETH. Real Uniswap fills. Tokenized stocks on Ethereum.</p>
        <Link to="/signup" className="tw-btn primary">Create free account</Link>
        <p className="tw-disclaimer">
          Not financial advice. Tokenized trackers, not brokerage shares. You can lose funds.
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
