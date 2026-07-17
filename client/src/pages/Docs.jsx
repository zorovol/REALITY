import { Link } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import { BRAND } from '../config/brand.js';

const SECTIONS = [
  { id: 'overview', title: 'Overview' },
  { id: 'architecture', title: 'Architecture' },
  { id: 'signup', title: 'Sign up & wallet' },
  { id: 'bots', title: 'Bots & rules' },
  { id: 'engine', title: 'Execution engine' },
  { id: 'funding', title: 'Funding & fees' },
  { id: 'faq', title: 'FAQ' },
];

export default function Docs() {
  return (
    <div className="docs-shell tw-docs">
      <PlatformNav />
      <div className="docs-layout">
        <aside className="docs-sidebar">
          <p className="docs-sidebar-label">Documentation</p>
          <nav>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`}>{s.title}</a>
            ))}
          </nav>
          <div className="docs-sidebar-cta">
            <Link to="/signup" className="tw-btn primary">Get started</Link>
          </div>
        </aside>

        <article className="docs-content">
          <header className="docs-hero">
            <BrandLogo size={48} className="docs-hero-logo-wrap" />
            <h1>{BRAND.fullName}</h1>
            <p className="docs-lead">
              Automated trading of tokenized stocks on Ethereum mainnet — Uniswap V3 fills, ETH settlement.
            </p>
          </header>

          <section id="overview" className="docs-section">
            <h2>Overview</h2>
            <p>
              {BRAND.name} runs trading bots on <strong>Ethereum</strong> (chain ID 1).
              You get an EVM wallet, fund it with ETH, and bots buy/sell tokenized stock trackers
              (Ondo <code>*on</code>, xStocks <code>*x</code>) through Uniswap V3.
            </p>
            <div className="docs-callout">
              <strong>Not financial advice.</strong> These are tokenized trackers, not brokerage shares.
              Ethereum L1 gas is real. You can lose funds.
            </div>
          </section>

          <section id="architecture" className="docs-section">
            <h2>Architecture</h2>
            <ol className="docs-steps">
              <li>Discovery pulls Ethereum Uniswap pairs for stock trackers (DexScreener).</li>
              <li>Bots rank candidates by strategy (volume, liquidity, turnover, random).</li>
              <li>Buys route ETH→stock via WETH direct or WETH→USDC→stock multi-hop.</li>
              <li>Sells reverse the path and unwrap WETH to ETH.</li>
            </ol>
          </section>

          <section id="signup" className="docs-section">
            <h2>Sign up &amp; wallet</h2>
            <p>
              Sign up generates an Ethereum wallet. Your <strong>0x address</strong> is your username.
              Private keys are dual-encrypted (password + server key) so bots can trade while you are offline.
            </p>
          </section>

          <section id="bots" className="docs-section">
            <h2>Bots &amp; rules</h2>
            <p>Each bot has a type (selection logic only) plus rules:</p>
            <ul>
              <li><code>minMarketCap</code> / <code>maxMarketCap</code> — on-chain FDV band</li>
              <li><code>buyAmountEth</code> — ETH per buy (~$15 default; L1 gas reserved separately)</li>
              <li><code>takeProfitPercent</code> / <code>stopLossPercent</code> — vs entry tracker price</li>
            </ul>
          </section>

          <section id="engine" className="docs-section">
            <h2>Execution engine</h2>
            <p>
              The backend ticks every few seconds. Active bots without a position buy the next
              routable stock in range; open positions exit on TP, SL, or max hold time.
              Tokens that fail quotes (KYC/allowlist/thin pools) are skipped.
            </p>
          </section>

          <section id="funding" className="docs-section">
            <h2>Funding &amp; fees</h2>
            <ul>
              <li>Send <strong>ETH on Ethereum mainnet</strong> (chain ID 1) — not an L2.</li>
              <li>Keep a gas reserve (~0.005 ETH default) — L1 swaps are expensive.</li>
              <li>Recommended starting balance: enough for buy size + several swaps of gas.</li>
            </ul>
          </section>

          <section id="faq" className="docs-section">
            <h2>FAQ</h2>
            <dl className="docs-faq">
              <dt>Do I own real shares?</dt>
              <dd>No. These are tokenized trackers issued by third parties (e.g. Ondo / Backed).</dd>
              <dt>Why didn&apos;t my bot buy?</dt>
              <dd>Usually low ETH for L1 gas, empty discovery band, or KYC-gated token transfers.</dd>
              <dt>Is this Robinhood Chain?</dt>
              <dd>No. TICKWIRE trades on Ethereum mainnet.</dd>
            </dl>
          </section>

          <footer className="docs-footer">
            <Link to="/">← Home</Link>
            <Link to="/signup">Create account</Link>
            <Link to="/dashboard">Dashboard</Link>
          </footer>
        </article>
      </div>
    </div>
  );
}
