import { Link } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import { BRAND } from '../config/brand.js';

const TAPE = [
  { s: 'NVDAon', d: '+1.24%', p: '$128.40' },
  { s: 'TSLAon', d: '-0.61%', p: '$248.12' },
  { s: 'AAPLon', d: '+0.38%', p: '$214.90' },
  { s: 'SPYon', d: '+0.19%', p: '$581.05' },
  { s: 'QQQon', d: '+0.72%', p: '$512.33' },
  { s: 'GOOGLon', d: '-0.22%', p: '$176.48' },
  { s: 'SPCXon', d: '+2.11%', p: '$42.17' },
  { s: 'MSFTon', d: '+0.44%', p: '$428.60' },
  { s: 'AMZNon', d: '+0.91%', p: '$198.04' },
  { s: 'METAx', d: '-0.35%', p: '$561.22' },
];

const STRATEGIES = [
  { id: 'chatgpt', name: 'ChatGPT', tag: 'VOLUME', desc: 'Volume leader — most-traded Robinhood stock trackers.' },
  { id: 'grok', name: 'Grok', tag: 'TURNOVER', desc: 'Turnover hunter — hottest ETH pool activity.' },
  { id: 'fable', name: 'Fable', tag: 'CHAOS', desc: 'Chaos mode — random across the stock universe.' },
  { id: 'gemini', name: 'Gemini', tag: 'DEPTH', desc: 'Liquidity first — deepest Uniswap V3 routes.' },
  { id: 'deepseek', name: 'DeepSeek', tag: 'SNIPE', desc: 'Thin-pool sniper — smaller liquidity bands.' },
];

const PIPELINE = [
  { n: '01', t: 'Discover', d: 'Scan Robinhood stock tokens with live Uniswap liquidity on Ethereum.' },
  { n: '02', t: 'Route', d: 'Quote WETH direct or WETH→USDC→stock multi-hop paths.' },
  { n: '03', t: 'Execute', d: 'Sign server-side, submit Uniswap V3 swaps with ETH.' },
  { n: '04', t: 'Exit', d: 'Take-profit, stop-loss, or time exit — unwrap back to ETH.' },
];

const STACK = ['Ethereum L1', 'Uniswap V3', 'WETH / USDC', 'Ondo · xStocks', 'Encrypted keys', '24/7 engine', 'DexScreener', 'Fair-price guard'];

const TERMINAL = [
  { t: '04:12:01', a: 'ENGINE', m: 'scan · 11 Robinhood stocks · ETH routes live', c: 'info' },
  { t: '04:12:04', a: 'GEMINI', m: 'BUY 0.006 ETH → NVDAon @ Uniswap V3', c: 'buy' },
  { t: '04:12:18', a: 'GEMINI', m: 'SELL NVDAon +2.8% · tx 0x8f…a1', c: 'sell' },
  { t: '04:12:22', a: 'CHATGPT', m: 'routing TSLAon via WETH→USDC hop…', c: 'info' },
  { t: '04:12:25', a: 'CHATGPT', m: 'BUY 0.006 ETH → TSLAon', c: 'buy' },
  { t: '04:12:31', a: 'GROK', m: 'quote QQQon · fee 0.3% · slip ok', c: 'info' },
];

const MARKET = [
  { s: 'NVDAon', ch: '+1.24%', liq: '$2.1M', route: 'WETH' },
  { s: 'TSLAon', ch: '-0.61%', liq: '$890K', route: 'USDC' },
  { s: 'AAPLon', ch: '+0.38%', liq: '$1.4M', route: 'WETH' },
  { s: 'SPYon', ch: '+0.19%', liq: '$3.2M', route: 'WETH' },
  { s: 'QQQon', ch: '+0.72%', liq: '$1.8M', route: 'USDC' },
  { s: 'SPCXon', ch: '+2.11%', liq: '$420K', route: 'WETH' },
];

const STATS = [
  { k: 'Chain', v: 'Ethereum L1' },
  { k: 'DEX', v: 'Uniswap V3' },
  { k: 'Settlement', v: 'ETH / WETH' },
  { k: 'Assets', v: 'Ondo · xStocks' },
];

function ChartBackdrop() {
  return (
    <svg className="tw-hero-svg" viewBox="0 0 1200 700" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="twFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00c805" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#00c805" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="twLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00c805" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#00c805" stopOpacity="1" />
          <stop offset="100%" stopColor="#00c805" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {[120, 220, 320, 420, 520].map((y) => (
        <line key={y} x1="0" y1={y} x2="1200" y2={y} stroke="rgba(0,200,5,0.08)" strokeWidth="1" />
      ))}
      {[200, 400, 600, 800, 1000].map((x) => (
        <line key={x} x1={x} y1="0" x2={x} y2="700" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      ))}
      <path
        className="tw-hero-area"
        d="M0,520 L80,500 160,510 240,430 320,450 400,360 480,380 560,300 640,320 720,250 800,270 880,190 960,210 1040,140 1120,160 1200,90 L1200,700 L0,700 Z"
        fill="url(#twFill)"
      />
      <path
        className="tw-hero-line"
        d="M0,520 L80,500 160,510 240,430 320,450 400,360 480,380 560,300 640,320 720,250 800,270 880,190 960,210 1040,140 1120,160 1200,90"
        fill="none"
        stroke="url(#twLine)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="tw-hero-pulse" cx="1200" cy="90" r="6" fill="#00c805" />
    </svg>
  );
}

function RouteViz() {
  return (
    <div className="tw-route" aria-hidden="true">
      <div className="tw-route-node">
        <span>ETH</span>
        <small>wallet</small>
      </div>
      <div className="tw-route-wire"><i /></div>
      <div className="tw-route-node mid">
        <span>WETH</span>
        <small>wrap</small>
      </div>
      <div className="tw-route-wire"><i /></div>
      <div className="tw-route-node mid">
        <span>V3</span>
        <small>pool</small>
      </div>
      <div className="tw-route-wire"><i /></div>
      <div className="tw-route-node end">
        <span>STOCK</span>
        <small>NVDAon</small>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="tw">
      <div className="tw-bg" aria-hidden="true">
        <div className="tw-wash" />
        <div className="tw-chart" />
        <div className="tw-scanline" />
      </div>

      <PlatformNav />

      <section className="tw-hero">
        <ChartBackdrop />
        <div className="tw-tape" aria-hidden="true">
          <div className="tw-tape-track">
            {[...TAPE, ...TAPE].map((row, i) => (
              <span key={`${row.s}-${i}`} className={row.d.startsWith('-') ? 'down' : 'up'}>
                <b>{row.s}</b> {row.p} {row.d}
              </span>
            ))}
          </div>
        </div>

        <div className="tw-hero-grid">
          <div className="tw-hero-copy">
            <p className="tw-live"><span className="tw-live-dot" /> Robinhood stocks on ETH</p>
            <h1 className="tw-brand" aria-label={BRAND.name}>
              <span className="tw-brand-accent">{BRAND.nameParts.accent}</span>
              <span className="tw-brand-rest">{BRAND.nameParts.rest}</span>
            </h1>
            <p className="tw-headline">Robinhood stocks. Traded on Ethereum.</p>
            <p className="tw-lead">
              Those tokenized stocks live on ETH — so TICKWIRE trades them on ETH with Uniswap bots, 24/7.
            </p>
            <div className="tw-cta">
              <Link to="/signup" className="tw-btn primary">Launch bots</Link>
              <Link to="/docs" className="tw-btn ghost">Read the stack</Link>
            </div>
          </div>

          <aside className="tw-terminal" aria-hidden="true">
            <div className="tw-terminal-bar">
              <span /><span /><span />
              <p>tickwire-engine · ethereum</p>
            </div>
            <div className="tw-terminal-body">
              {TERMINAL.map((line) => (
                <div key={`${line.t}-${line.m}`} className={`tw-terminal-line ${line.c}`}>
                  <span className="t">{line.t}</span>
                  <span className="a">{line.a}</span>
                  <span className="m">{line.m}</span>
                </div>
              ))}
              <span className="tw-terminal-cursor">▊</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="tw-rail" aria-label="Stack facts">
        <div className="tw-rail-inner">
          {STATS.map((s) => (
            <div key={s.k} className="tw-rail-item">
              <span>{s.k}</span>
              <strong>{s.v}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="tw-section tw-why">
        <div className="tw-section-head">
          <p className="tw-eyebrow">Why Ethereum</p>
          <h2>Robinhood stocks settle on ETH.</h2>
          <p className="tw-sub">
            Tokenized Robinhood-style equities (Ondo / xStocks) trade as ERC-20s on Ethereum mainnet.
            We don&apos;t fake an L2 path — we route where the liquidity actually is.
          </p>
        </div>
        <div className="tw-why-grid">
          <article>
            <span className="tw-why-num">01</span>
            <h3>Stock universe</h3>
            <p>NVDA, TSLA, AAPL, SPY, QQQ and more as on-chain trackers with Uniswap depth.</p>
          </article>
          <article>
            <span className="tw-why-num">02</span>
            <h3>ETH settlement</h3>
            <p>Buys and sells with ETH via WETH — or multi-hop through USDC when that&apos;s the liquid pool.</p>
          </article>
          <article>
            <span className="tw-why-num">03</span>
            <h3>Real fills</h3>
            <p>Uniswap V3 swaps on chain ID 1. Etherscan receipts. No simulated Robinhood Chain hops.</p>
          </article>
        </div>
      </section>

      <section className="tw-section tw-markets">
        <div className="tw-section-head tw-section-head-row">
          <div>
            <p className="tw-eyebrow">Live desk</p>
            <h2>Markets the bots hunt.</h2>
          </div>
          <p className="tw-sub tw-sub-tight">Illustrative board — real discovery pulls live Uniswap depth on ETH.</p>
        </div>
        <div className="tw-market-board">
          <div className="tw-market-head">
            <span>Symbol</span>
            <span>24h</span>
            <span>Liquidity</span>
            <span>Route</span>
          </div>
          {MARKET.map((row) => (
            <div key={row.s} className={`tw-market-row ${row.ch.startsWith('-') ? 'down' : 'up'}`}>
              <strong>{row.s}</strong>
              <span className="ch">{row.ch}</span>
              <span className="liq">{row.liq}</span>
              <span className="route">{row.route}</span>
            </div>
          ))}
        </div>
        <RouteViz />
      </section>

      <section className="tw-section">
        <div className="tw-section-head">
          <p className="tw-eyebrow">Engine</p>
          <h2>From scan to fill.</h2>
        </div>
        <div className="tw-pipe">
          {PIPELINE.map((step) => (
            <article key={step.n} className="tw-pipe-step">
              <span>{step.n}</span>
              <h3>{step.t}</h3>
              <p>{step.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tw-section">
        <div className="tw-section-head">
          <p className="tw-eyebrow">Agents</p>
          <h2>Five strategies. Same ETH rails.</h2>
        </div>
        <div className="tw-strat-row">
          {STRATEGIES.map((s) => (
            <article key={s.id} className="tw-strat">
              <span className="tw-strat-tag">{s.tag}</span>
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tw-stack" aria-label="Tech stack">
        <div className="tw-stack-inner">
          {STACK.map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      <section className="tw-section tw-flow">
        <p className="tw-eyebrow">Setup</p>
        <h2>Live in under a minute</h2>
        <ol className="tw-steps">
          <li><span>01</span>Create account</li>
          <li><span>02</span>Fund ETH on mainnet</li>
          <li><span>03</span>Start a bot</li>
          <li><span>04</span>Watch Uniswap fills</li>
        </ol>
      </section>

      <section className="tw-final">
        <div className="tw-final-glow" aria-hidden="true" />
        <h2>Trade Robinhood stocks where they live — on ETH.</h2>
        <p>Sign up free. Fund Ethereum. Let TICKWIRE run Uniswap bots around the clock.</p>
        <Link to="/signup" className="tw-btn primary">Create free account</Link>
        <p className="tw-disclaimer">
          Not financial advice. Tokenized trackers, not brokerage shares. L1 gas applies. You can lose funds.
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
