import { Link } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import { BRAND } from '../config/brand.js';

const TAPE = [
  { s: 'NVDAon', d: '+1.24%', p: '128.40' },
  { s: 'TSLAon', d: '-0.61%', p: '248.12' },
  { s: 'AAPLon', d: '+0.38%', p: '214.90' },
  { s: 'SPYon', d: '+0.19%', p: '581.05' },
  { s: 'QQQon', d: '+0.72%', p: '512.33' },
  { s: 'GOOGLon', d: '-0.22%', p: '176.48' },
  { s: 'SPCXon', d: '+2.11%', p: '42.17' },
  { s: 'MSFTon', d: '+0.44%', p: '428.60' },
  { s: 'AMZNon', d: '+0.91%', p: '198.04' },
  { s: 'METAx', d: '-0.35%', p: '561.22' },
  { s: 'AVGO', d: '+1.08%', p: '184.22' },
  { s: 'COINx', d: '+3.40%', p: '268.10' },
];

const STRATEGIES = [
  { id: 'chatgpt', name: 'ChatGPT', tag: 'VOL', pct: 92, desc: 'Volume leader — most-traded Robinhood stock trackers.' },
  { id: 'grok', name: 'Grok', tag: 'HOT', pct: 78, desc: 'Turnover hunter — hottest ETH pool activity.' },
  { id: 'fable', name: 'Fable', tag: 'RND', pct: 64, desc: 'Chaos mode — random across the stock universe.' },
  { id: 'gemini', name: 'Gemini', tag: 'LIQ', pct: 88, desc: 'Liquidity first — deepest Uniswap V3 routes.' },
  { id: 'deepseek', name: 'DeepSeek', tag: 'SNP', pct: 71, desc: 'Thin-pool sniper — smaller liquidity bands.' },
];

const PIPELINE = [
  { n: '01', t: 'DISCOVER', d: 'Scan Robinhood stock tokens with live Uniswap liquidity on Ethereum.' },
  { n: '02', t: 'ROUTE', d: 'Quote WETH direct or WETH→USDC→stock multi-hop paths.' },
  { n: '03', t: 'EXECUTE', d: 'Sign server-side, submit Uniswap V3 swaps with ETH.' },
  { n: '04', t: 'EXIT', d: 'Take-profit, stop-loss, or time exit — unwrap back to ETH.' },
];

const STACK = ['ETH·L1', 'UNISWAP·V3', 'WETH/USDC', 'ONDO', 'XSTOCKS', 'DEXSCREENER', 'FAIR·PRICE', 'ENC·KEYS', '24/7·ENGINE'];

const TERMINAL = [
  { t: '04:12:01.084', a: 'ENGINE', m: 'scan_ok · 11 stocks · eth_mainnet', c: 'info' },
  { t: '04:12:04.211', a: 'GEMINI', m: 'BUY 0.006Ξ → NVDAon · fee=0.3%', c: 'buy' },
  { t: '04:12:18.903', a: 'GEMINI', m: 'SELL NVDAon +2.8% · 0x8f…a1', c: 'sell' },
  { t: '04:12:22.441', a: 'CHATGPT', m: 'path TSLAon via WETH→USDC', c: 'info' },
  { t: '04:12:25.017', a: 'CHATGPT', m: 'BUY 0.006Ξ → TSLAon · filled', c: 'buy' },
  { t: '04:12:31.660', a: 'GROK', m: 'quote QQQon · slip=0.12% · ok', c: 'info' },
];

const MARKET = [
  { s: 'NVDAon', ch: '+1.24%', liq: '2.14M', route: 'WETH', bars: [40, 55, 48, 70, 62, 80, 74] },
  { s: 'TSLAon', ch: '-0.61%', liq: '890K', route: 'USDC', bars: [60, 52, 48, 44, 50, 38, 42] },
  { s: 'AAPLon', ch: '+0.38%', liq: '1.41M', route: 'WETH', bars: [30, 35, 42, 40, 48, 52, 55] },
  { s: 'SPYon', ch: '+0.19%', liq: '3.22M', route: 'WETH', bars: [70, 72, 68, 75, 74, 78, 80] },
  { s: 'QQQon', ch: '+0.72%', liq: '1.88M', route: 'USDC', bars: [45, 50, 55, 52, 60, 65, 70] },
  { s: 'SPCXon', ch: '+2.11%', liq: '420K', route: 'WETH', bars: [20, 28, 35, 42, 55, 60, 78] },
];

const DEPTH = [
  { side: 'ask', px: '128.62', sz: '0.84', w: 35 },
  { side: 'ask', px: '128.51', sz: '1.20', w: 48 },
  { side: 'ask', px: '128.44', sz: '2.05', w: 72 },
  { side: 'bid', px: '128.38', sz: '1.90', w: 68 },
  { side: 'bid', px: '128.30', sz: '1.45', w: 52 },
  { side: 'bid', px: '128.18', sz: '0.92', w: 38 },
];

const CANDLES = [
  { x: 40, o: 420, c: 380, h: 360, l: 440 },
  { x: 90, o: 380, c: 410, h: 350, l: 430 },
  { x: 140, o: 410, c: 350, h: 330, l: 430 },
  { x: 190, o: 350, c: 320, h: 300, l: 370 },
  { x: 240, o: 320, c: 360, h: 300, l: 380 },
  { x: 290, o: 360, c: 300, h: 280, l: 380 },
  { x: 340, o: 300, c: 270, h: 250, l: 320 },
  { x: 390, o: 270, c: 310, h: 250, l: 330 },
  { x: 440, o: 310, c: 250, h: 230, l: 330 },
  { x: 490, o: 250, c: 220, h: 200, l: 270 },
  { x: 540, o: 220, c: 260, h: 200, l: 280 },
  { x: 590, o: 260, c: 200, h: 180, l: 280 },
  { x: 640, o: 200, c: 180, h: 160, l: 220 },
  { x: 690, o: 180, c: 210, h: 160, l: 230 },
  { x: 740, o: 210, c: 160, h: 140, l: 230 },
  { x: 790, o: 160, c: 140, h: 120, l: 180 },
  { x: 840, o: 140, c: 170, h: 120, l: 190 },
  { x: 890, o: 170, c: 130, h: 110, l: 190 },
  { x: 940, o: 130, c: 110, h: 90, l: 150 },
  { x: 990, o: 110, c: 95, h: 80, l: 130 },
];

function HudCorners() {
  return (
    <>
      <i className="tw-hud-c tl" /><i className="tw-hud-c tr" />
      <i className="tw-hud-c bl" /><i className="tw-hud-c br" />
    </>
  );
}

function HeroSurface() {
  return (
    <svg className="tw-hero-svg" viewBox="0 0 1200 700" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="twFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00c805" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#00c805" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="twLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00c805" stopOpacity="0.1" />
          <stop offset="55%" stopColor="#00c805" stopOpacity="1" />
          <stop offset="100%" stopColor="#7dff7a" stopOpacity="0.35" />
        </linearGradient>
        <radialGradient id="twGlow" cx="85%" cy="18%" r="35%">
          <stop offset="0%" stopColor="#00c805" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#00c805" stopOpacity="0" />
        </radialGradient>
        <filter id="twSoft">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      <rect width="1200" height="700" fill="url(#twGlow)" />

      {Array.from({ length: 14 }, (_, i) => (
        <line key={`h${i}`} x1="0" y1={50 + i * 45} x2="1200" y2={50 + i * 45} stroke="rgba(0,200,5,0.06)" strokeWidth="1" />
      ))}
      {Array.from({ length: 24 }, (_, i) => (
        <line key={`v${i}`} x1={50 + i * 50} y1="0" x2={50 + i * 50} y2="700" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
      ))}

      {CANDLES.map((c) => {
        const up = c.c < c.o;
        const top = Math.min(c.o, c.c);
        const h = Math.abs(c.o - c.c) || 4;
        return (
          <g key={c.x} className="tw-candle" opacity="0.55">
            <line x1={c.x + 10} y1={c.h} x2={c.x + 10} y2={c.l} stroke={up ? '#00c805' : '#ff5000'} strokeWidth="1.5" />
            <rect x={c.x} y={top} width="20" height={h} fill={up ? '#00c805' : '#ff5000'} opacity="0.85" />
          </g>
        );
      })}

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
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#twSoft)"
      />
      <path
        className="tw-hero-line tw-hero-line-sharp"
        d="M0,520 L80,500 160,510 240,430 320,450 400,360 480,380 560,300 640,320 720,250 800,270 880,190 960,210 1040,140 1120,160 1200,90"
        fill="none"
        stroke="#00c805"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <g className="tw-crosshair">
        <line x1="990" y1="0" x2="990" y2="700" stroke="rgba(0,200,5,0.25)" strokeWidth="1" strokeDasharray="4 6" />
        <line x1="0" y1="95" x2="1200" y2="95" stroke="rgba(0,200,5,0.2)" strokeWidth="1" strokeDasharray="4 6" />
        <circle cx="990" cy="95" r="5" fill="#00c805" />
        <circle className="tw-hero-pulse" cx="990" cy="95" r="5" fill="#00c805" />
      </g>

      {[120, 280, 460, 700, 920].map((x, i) => (
        <rect key={x} className="tw-vol-bar" x={x} y={640 - (i % 3) * 18} width="14" height={40 + (i % 4) * 12} fill="rgba(0,200,5,0.25)" />
      ))}
    </svg>
  );
}

function RadarRing({ running }) {
  return (
    <svg className={`tw-radar ${running ? 'on' : ''}`} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(0,200,5,0.15)" strokeWidth="1" />
      <circle cx="60" cy="60" r="36" fill="none" stroke="rgba(0,200,5,0.2)" strokeWidth="1" />
      <circle cx="60" cy="60" r="20" fill="none" stroke="rgba(0,200,5,0.3)" strokeWidth="1" />
      <circle cx="60" cy="60" r="4" fill="#00c805" />
      <line className="tw-radar-sweep" x1="60" y1="60" x2="60" y2="8" stroke="#00c805" strokeWidth="2" strokeLinecap="round" />
      <circle cx="82" cy="38" r="2.5" fill="#00c805" className="tw-radar-blip" />
      <circle cx="40" cy="70" r="2" fill="#7dff7a" className="tw-radar-blip d2" />
      <circle cx="75" cy="78" r="1.8" fill="#00c805" className="tw-radar-blip d3" />
    </svg>
  );
}

function Spark({ bars, up }) {
  return (
    <svg className="tw-spark" viewBox="0 0 56 20" aria-hidden="true">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 8}
          y={20 - h / 5}
          width="5"
          height={h / 5}
          fill={up ? '#00c805' : '#ff5000'}
          opacity={0.4 + i * 0.08}
        />
      ))}
    </svg>
  );
}

export default function Home() {
  return (
    <div className="tw tw-x">
      <div className="tw-bg" aria-hidden="true">
        <div className="tw-wash" />
        <div className="tw-hex" />
        <div className="tw-chart" />
        <div className="tw-rain" />
        <div className="tw-scanline" />
      </div>

      <PlatformNav />

      <section className="tw-hero">
        <HeroSurface />

        <div className="tw-tape" aria-hidden="true">
          <div className="tw-tape-track">
            {[...TAPE, ...TAPE].map((row, i) => (
              <span key={`${row.s}-${i}`} className={row.d.startsWith('-') ? 'down' : 'up'}>
                <b>{row.s}</b>
                <em>${row.p}</em>
                {row.d}
              </span>
            ))}
          </div>
        </div>

        <div className="tw-hero-grid">
          <div className="tw-hero-copy">
            <p className="tw-live">
              <span className="tw-live-dot" />
              SYS · ETHEREUM MAINNET · UNISWAP V3
            </p>
            <h1 className="tw-brand" aria-label={BRAND.name}>
              <span className="tw-brand-accent">{BRAND.nameParts.accent}</span>
              <span className="tw-brand-rest">{BRAND.nameParts.rest}</span>
            </h1>
            <p className="tw-headline">Robinhood stocks. Traded on Ethereum.</p>
            <p className="tw-lead">
              Tokenized equities live on ETH — TICKWIRE runs Uniswap bots against them, 24/7.
            </p>
            <div className="tw-cta">
              <Link to="/signup" className="tw-btn primary">
                <span className="tw-btn-glow" />
                Launch bots
              </Link>
              <Link to="/docs" className="tw-btn ghost">Read the stack</Link>
            </div>
          </div>

          <div className="tw-hero-rig" aria-hidden="true">
            <aside className="tw-terminal tw-hud">
              <HudCorners />
              <div className="tw-terminal-bar">
                <span /><span /><span />
                <p>tickwire://engine · ethereum</p>
                <em className="tw-term-live">LIVE</em>
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

            <aside className="tw-depth tw-hud">
              <HudCorners />
              <div className="tw-depth-head">
                <span>NVDAon · DEPTH</span>
                <strong>128.40</strong>
              </div>
              <div className="tw-depth-body">
                {DEPTH.map((row) => (
                  <div key={`${row.side}-${row.px}`} className={`tw-depth-row ${row.side}`}>
                    <i style={{ width: `${row.w}%` }} />
                    <span className="px">{row.px}</span>
                    <span className="sz">{row.sz}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="tw-rail" aria-label="Stack facts">
        <div className="tw-rail-inner">
          {[
            { k: 'CHAIN_ID', v: '0x1' },
            { k: 'DEX', v: 'UNISWAP_V3' },
            { k: 'SETTLE', v: 'ETH/WETH' },
            { k: 'ASSETS', v: 'ONDO·XSTOCKS' },
            { k: 'MODE', v: 'AUTONOMOUS' },
          ].map((s) => (
            <div key={s.k} className="tw-rail-item">
              <span>{s.k}</span>
              <strong>{s.v}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="tw-section tw-why">
        <div className="tw-section-head">
          <p className="tw-eyebrow">// WHY_ETH</p>
          <h2>Robinhood stocks settle on ETH.</h2>
          <p className="tw-sub">
            Ondo / xStocks trade as ERC-20s on Ethereum mainnet. We route where the liquidity actually is.
          </p>
        </div>
        <div className="tw-why-grid">
          {[
            { n: '01', t: 'Stock universe', d: 'NVDA, TSLA, AAPL, SPY, QQQ and more as on-chain trackers with Uniswap depth.' },
            { n: '02', t: 'ETH settlement', d: 'Buys and sells with ETH via WETH — or multi-hop through USDC when that pool is deeper.' },
            { n: '03', t: 'Real fills', d: 'Uniswap V3 swaps on chain ID 1. Etherscan receipts. No simulated L2 hops.' },
          ].map((a) => (
            <article key={a.n} className="tw-hud tw-why-card">
              <HudCorners />
              <span className="tw-why-num">{a.n}</span>
              <h3>{a.t}</h3>
              <p>{a.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="tw-section tw-markets">
        <div className="tw-section-head tw-section-head-row">
          <div>
            <p className="tw-eyebrow">// LIVE_DESK</p>
            <h2>Markets the bots hunt.</h2>
          </div>
          <p className="tw-sub tw-sub-tight">Illustrative board — live discovery pulls real Uniswap depth on ETH.</p>
        </div>

        <div className="tw-market-shell tw-hud">
          <HudCorners />
          <div className="tw-market-board">
            <div className="tw-market-head">
              <span>SYMBOL</span>
              <span>24H</span>
              <span>LIQ</span>
              <span>SPARK</span>
              <span>ROUTE</span>
            </div>
            {MARKET.map((row) => (
              <div key={row.s} className={`tw-market-row ${row.ch.startsWith('-') ? 'down' : 'up'}`}>
                <strong>{row.s}</strong>
                <span className="ch">{row.ch}</span>
                <span className="liq">{row.liq}</span>
                <Spark bars={row.bars} up={!row.ch.startsWith('-')} />
                <span className="route">{row.route}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="tw-route tw-hud" aria-hidden="true">
          <HudCorners />
          {[
            { t: 'ETH', s: 'wallet' },
            { t: 'WETH', s: 'wrap' },
            { t: 'V3', s: 'pool' },
            { t: 'STOCK', s: 'NVDAon', end: true },
          ].map((n, i, arr) => (
            <div key={n.t} className="tw-route-seg">
              <div className={`tw-route-node ${n.end ? 'end' : 'mid'}`}>
                <span>{n.t}</span>
                <small>{n.s}</small>
              </div>
              {i < arr.length - 1 && <div className="tw-route-wire"><i /></div>}
            </div>
          ))}
        </div>
      </section>

      <section className="tw-section">
        <div className="tw-section-head">
          <p className="tw-eyebrow">// PIPELINE</p>
          <h2>From scan to fill.</h2>
        </div>
        <div className="tw-pipe">
          {PIPELINE.map((step, i) => (
            <article key={step.n} className="tw-pipe-step tw-hud">
              <HudCorners />
              <span>{step.n}</span>
              <h3>{step.t}</h3>
              <p>{step.d}</p>
              {i < PIPELINE.length - 1 && <b className="tw-pipe-arrow" aria-hidden="true" />}
            </article>
          ))}
        </div>
      </section>

      <section className="tw-section">
        <div className="tw-section-head">
          <p className="tw-eyebrow">// AGENTS</p>
          <h2>Five strategies. Same ETH rails.</h2>
        </div>
        <div className="tw-strat-row">
          {STRATEGIES.map((s) => (
            <article key={s.id} className="tw-strat tw-hud">
              <HudCorners />
              <div className="tw-strat-top">
                <span className="tw-strat-tag">{s.tag}</span>
                <em>{s.pct}%</em>
              </div>
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
              <div className="tw-strat-bar"><i style={{ width: `${s.pct}%` }} /></div>
            </article>
          ))}
        </div>
      </section>

      <section className="tw-stack" aria-label="Tech stack">
        <div className="tw-stack-inner">
          {STACK.map((item) => <span key={item}>{item}</span>)}
          {STACK.map((item) => <span key={`${item}-2`}>{item}</span>)}
        </div>
      </section>

      <section className="tw-section tw-sys">
        <div className="tw-sys-grid">
          <div className="tw-sys-copy">
            <p className="tw-eyebrow">// BOOT_SEQUENCE</p>
            <h2>Live in under a minute</h2>
            <ol className="tw-steps">
              <li><span>01</span>Create account</li>
              <li><span>02</span>Fund ETH on mainnet</li>
              <li><span>03</span>Start a bot</li>
              <li><span>04</span>Watch Uniswap fills</li>
            </ol>
          </div>
          <div className="tw-sys-viz tw-hud" aria-hidden="true">
            <HudCorners />
            <RadarRing running />
            <div className="tw-sys-meta">
              <p>ENGINE</p>
              <strong>ONLINE</strong>
              <span>scan_rate · 2.4s</span>
              <span>gas_reserve · 0.005Ξ</span>
              <span>routes · V3 multi-hop</span>
            </div>
          </div>
        </div>
      </section>

      <section className="tw-final tw-hud">
        <HudCorners />
        <div className="tw-final-glow" aria-hidden="true" />
        <h2>Trade Robinhood stocks where they live — on ETH.</h2>
        <p>Sign up free. Fund Ethereum. Let TICKWIRE run Uniswap bots around the clock.</p>
        <Link to="/signup" className="tw-btn primary"><span className="tw-btn-glow" />Create free account</Link>
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
