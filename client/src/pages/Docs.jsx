import { Link } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import { BRAND } from '../config/brand.js';

const SECTIONS = [
  { id: 'overview', title: 'Overview' },
  { id: 'architecture', title: 'Architecture' },
  { id: 'signup', title: 'Sign up & wallet' },
  { id: 'login', title: 'Login & sessions' },
  { id: 'dashboard', title: 'Dashboard' },
  { id: 'bots', title: 'Creating bots' },
  { id: 'bot-types', title: 'Bot types' },
  { id: 'rules', title: 'Trading rules' },
  { id: 'engine', title: 'Bot execution engine' },
  { id: 'live-floor', title: 'Live trading floor' },
  { id: 'security', title: 'Security' },
  { id: 'funding', title: 'Funding & fees' },
  { id: 'faq', title: 'FAQ' },
];

export default function Docs() {
  return (
    <div className="docs-shell">
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
            <Link to="/signup" className="home-v2-btn primary">Get started</Link>
          </div>
        </aside>

        <article className="docs-content">
          <header className="docs-hero">
            <BrandLogo size={64} className="docs-hero-logo-wrap" />
            <h1>{BRAND.fullName}</h1>
            <p className="docs-lead">
              Everything you need to understand how {BRAND.name} works — from account creation
              to automated trading of Robinhood real-world assets (tokenized stocks) on Robinhood Chain.
            </p>
          </header>

          <section id="overview" className="docs-section">
            <h2>Overview</h2>
            <p>
              {BRAND.name} is an automated trading platform on <strong>Robinhood Chain</strong> (EVM L2, chain ID 4663).
              You sign up with a password, receive an Ethereum wallet automatically, fund it with ETH,
              then create trading bots that scan <strong>Robinhood real-world assets</strong> — tokenized stocks and ETFs
              like NVDA, TSLA, AAPL and SPY issued as &quot;Robinhood Token&quot; ERC-20s — and execute buy/sell swaps
              through <strong>Uniswap V4</strong> on your behalf — 24/7.
            </p>
            <p>There are two parallel experiences:</p>
            <ul>
              <li><strong>Your bots</strong> — bots you create, configure, and control from the dashboard.</li>
              <li><strong>Live trading floor</strong> — five AI agents (ChatGPT, Grok, Fable, Gemini, DeepSeek) trading publicly on a shared broadcast UI.</li>
            </ul>
            <div className="docs-callout">
              <strong>Not financial advice.</strong> This is real on-chain trading with real ETH on Robinhood Chain.
              You can lose funds. Only trade what you can afford to lose.
            </div>
          </section>

          <section id="architecture" className="docs-section">
            <h2>Architecture</h2>
            <p>The platform splits into a frontend on Vercel and a unified backend on Render:</p>
            <div className="docs-diagram">
              <pre>{`┌─────────────────────────────────────────────────────────────┐
│  Browser (Vercel — static UI)                               │
│  Homepage · Docs · Signup · Login · Dashboard · Live Floor  │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
        All /api/* requests       WebSocket /socket.io
        (proxied to Render)       (proxied to Render)
                │                         │
                └────────────┬────────────┘
                             ▼
              ┌───────────────────────────────┐
              │  Render Backend               │
              │  · Signup / login / sessions  │
              │  · Bot CRUD + execution       │
              │  · Live AI trading floor      │
              │  · Uniswap V4 stock swaps     │
              │  · Encrypted wallet keys      │
              └───────────────┬───────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       PostgreSQL (optional)          Robinhood Chain RPC
       Users · Sessions · Bots        Stock tokens → Uniswap V4
`}</pre>
            </div>
            <h3>Data flow for a user bot trade</h3>
            <ol className="docs-steps">
              <li>Backend loads all <strong>active</strong> bots from the database.</li>
              <li>For each bot, it decrypts the user&apos;s wallet server-side (never sent to browser).</li>
              <li>The stock-token pool is refreshed from Robinhood Chain — every official &quot;Robinhood Token&quot; RWA plus its Uniswap V4 ETH pools.</li>
              <li>The bot type determines <em>which</em> stock token to pick from the filtered list.</li>
              <li>A buy swap (ETH → stock token) is submitted through the Uniswap V4 UniversalRouter if the bot has no open position and the token has a live V4 pool.</li>
              <li>When take-profit, stop-loss (tracked against the live stock price), or a time limit hits, a sell swap is submitted.</li>
              <li>Trade results are logged to the database and visible on your dashboard.</li>
            </ol>
          </section>

          <section id="signup" className="docs-section">
            <h2>Sign up &amp; wallet</h2>
            <p>When you click <Link to="/signup">Sign up</Link> and set a password:</p>
            <ol className="docs-steps">
              <li>A new <strong>EVM wallet</strong> is generated in your browser (or on the server for server-side signup).</li>
              <li>Your <strong>wallet address</strong> (0x…) becomes your username.</li>
              <li>Your password is hashed with <strong>scrypt</strong> — the raw password is never stored.</li>
              <li>Your private key is encrypted twice:
                <ul>
                  <li><strong>Password layer</strong> — encrypted with a key derived from your password (recovery/verification).</li>
                  <li><strong>Server layer</strong> — encrypted with <code>AUTH_SERVER_KEY</code> so bots can trade 24/7 without you being logged in.</li>
                </ul>
              </li>
              <li>A session cookie is set and you are redirected to the dashboard.</li>
            </ol>
            <p>
              <strong>Important:</strong> Save your wallet address after signup — it is your login username.
              There is no seed phrase export in the UI; treat your password as the key to your account.
            </p>
          </section>

          <section id="login" className="docs-section">
            <h2>Login &amp; sessions</h2>
            <p>Log in with:</p>
            <ul>
              <li><strong>Username</strong> = your Robinhood Chain wallet address (0x…)</li>
              <li><strong>Password</strong> = the password you chose at signup</li>
            </ul>
            <p>
              On success, a secure <strong>httpOnly cookie</strong> (<code>adi_session</code>) is issued,
              valid for 7 days. The private key is never returned to the browser at any point.
            </p>
            <p>
              All authenticated API calls (<code>/api/auth/me</code>, <code>/api/bots</code>, etc.)
              require this cookie. Logging out deletes the session server-side and clears the cookie.
            </p>
          </section>

          <section id="dashboard" className="docs-section">
            <h2>Dashboard</h2>
            <p>After login, the <Link to="/dashboard">dashboard</Link> shows:</p>
            <ul>
              <li>Your wallet address and live <strong>ETH balance</strong></li>
              <li>All bots you have created</li>
              <li>Each bot&apos;s status (active / stopped), type, rules, and open position</li>
              <li>Controls to start, stop, or delete bots</li>
            </ul>
            <p>
              Fund your wallet by bridging ETH to Robinhood Chain (chain ID 4663).
              Bots need ETH for trade size plus ~0.0003 ETH reserved for gas.
            </p>
          </section>

          <section id="bots" className="docs-section">
            <h2>Creating bots</h2>
            <p>Click <strong>Create Bot</strong> on the dashboard:</p>
            <ol className="docs-steps">
              <li>Choose a <strong>bot type</strong> (see below — affects token selection only).</li>
              <li>Set your <strong>trading rules</strong> (market cap range, buy size, TP/SL).</li>
              <li>Save — the bot starts in <strong>stopped</strong> state.</li>
              <li>Click <strong>Start</strong> when you are ready for it to trade.</li>
            </ol>
            <p>
              Each bot connects to <em>your</em> wallet automatically. You can run multiple bots,
              but only one open position per bot at a time.
            </p>
          </section>

          <section id="bot-types" className="docs-section">
            <h2>Bot types</h2>
            <p>Bot types do <strong>not</strong> change your trading rules. They only change how tokens are ranked and selected from the filtered pool:</p>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Selection behavior</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><code>chatgpt</code></td><td>Prioritizes the most-traded stock tokens (highest 24h on-chain volume).</td></tr>
                  <tr><td><code>grok</code></td><td>Prioritizes turnover — volume relative to on-chain cap (hottest pools).</td></tr>
                  <tr><td><code>fable</code></td><td>Random selection — chaos mode.</td></tr>
                  <tr><td><code>gemini</code></td><td>Blue chips — biggest on-chain caps in range (NVDA, TSLA, AAPL…).</td></tr>
                  <tr><td><code>deepseek</code></td><td>Always picks the smallest on-chain cap in your configured range.</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="rules" className="docs-section">
            <h2>Trading rules</h2>
            <p>Every bot uses the same rule set you configure at creation time:</p>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Description</th>
                    <th>Default</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><code>minMarketCap</code></td><td>Minimum on-chain circulating cap (USD) for a stock token to be considered.</td><td>$1,000</td></tr>
                  <tr><td><code>maxMarketCap</code></td><td>Maximum on-chain circulating cap (USD) for a stock token to be considered.</td><td>$10,000,000</td></tr>
                  <tr><td><code>buyAmountEth</code></td><td>ETH spent per buy swap (~$5 default).</td><td>~0.00143 ETH</td></tr>
                  <tr><td><code>takeProfitPercent</code></td><td>Sell when the stock price rises this % above entry.</td><td>3%</td></tr>
                  <tr><td><code>stopLossPercent</code></td><td>Sell when the stock price drops this % below entry.</td><td>2%</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              Only official Robinhood stock tokens (name ends in &quot;Robinhood Token&quot;) are considered —
              tokenized US stocks and ETFs like NVDA, TSLA, AAPL, AMZN, SPY and QQQ.
              The &quot;on-chain cap&quot; is the circulating cap of the token on Robinhood Chain, not the company&apos;s
              real market cap — NVDA on-chain is roughly $1.7M. Tokens without a live Uniswap V4 ETH pool are skipped.
            </p>
          </section>

          <section id="engine" className="docs-section">
            <h2>Bot execution engine</h2>
            <p>The backend runs a continuous loop (approximately every 3 seconds) on Render:</p>
            <ol className="docs-steps">
              <li>Fetch all bots where <code>isActive = true</code>.</li>
              <li>Refresh the stock-token pool (Robinhood Chain token registry + Uniswap V4 pool scan).</li>
              <li>For each active bot:
                <ul>
                  <li>If holding a position → check take-profit / stop-loss against the live stock price, or a 10-minute time limit → sell if triggered.</li>
                  <li>If no position and wallet has enough ETH → filter by on-chain cap range → apply bot type selection → verify a live V4 quote → buy.</li>
                </ul>
              </li>
              <li>Log every buy/sell with transaction hash (viewable on Blockscout).</li>
            </ol>
            <p>
              The engine swaps through the Uniswap V4 UniversalRouter on Robinhood Chain —
              real on-chain trades of tokenized stocks against native ETH.
            </p>
          </section>

          <section id="live-floor" className="docs-section">
            <h2>Trading floor</h2>
            <p>
              The <Link to="/live">Trading Floor</Link> is a public showcase of every user&apos;s
              <strong> named</strong> bot. When you create a bot on your dashboard, give it a name (min 2 characters)
              and it appears on the floor for everyone to see — AI type, rules, and live/stopped status.
            </p>
            <ul>
              <li>Unnamed bots stay private on your dashboard only.</li>
              <li>Rename anytime — updates sync to the floor on blur.</li>
              <li>Delete a bot to remove it from the floor.</li>
            </ul>
          </section>

          <section id="security" className="docs-section">
            <h2>Security</h2>
            <ul className="docs-checklist">
              <li>Private keys are <strong>never</strong> sent to the frontend or exposed via API.</li>
              <li>Private keys are encrypted at rest (password layer + server layer).</li>
              <li>Decryption happens server-side only, during trade execution.</li>
              <li>Session cookies are httpOnly — not accessible to JavaScript.</li>
              <li>Passwords are hashed with scrypt; raw passwords are never stored.</li>
              <li>No private keys in logs, responses, or client-side storage.</li>
            </ul>
            <div className="docs-callout warn">
              Never share your password or session cookie. If you deployed this yourself,
              keep <code>AUTH_SERVER_KEY</code> and <code>DATABASE_URL</code> secret in Vercel/Render env vars.
            </div>
          </section>

          <section id="funding" className="docs-section">
            <h2>Funding &amp; fees</h2>
            <ul>
              <li>Bridge <strong>ETH</strong> to your wallet on Robinhood Chain (chain ID 4663).</li>
              <li>Each buy uses <code>buyAmountEth</code> from your rules.</li>
              <li>Keep extra ETH for gas (~0.0003 ETH per swap).</li>
              <li>Recommended minimum: ~0.01 ETH to start (trade size + gas buffer).</li>
            </ul>
            <p>
              Slippage, pool liquidity, and failed transactions can occur on volatile markets.
              Not every trade will be profitable.
            </p>
          </section>

          <section id="faq" className="docs-section">
            <h2>FAQ</h2>
            <dl className="docs-faq">
              <dt>What is my username?</dt>
              <dd>Your Robinhood Chain wallet address (0x…) — shown after signup and on the dashboard.</dd>

              <dt>Can I export my private key?</dt>
              <dd>Not through the UI. Keys are server-managed for automated trading.</dd>

              <dt>Why isn&apos;t my bot trading?</dt>
              <dd>Check: bot is started, wallet has ETH on Robinhood Chain, stock tokens exist in your on-chain cap range, Render backend is running.</dd>

              <dt>Do I own real shares?</dt>
              <dd>No. These are Robinhood&apos;s tokenized stock ERC-20s on Robinhood Chain — on-chain tokens that track the stock, not brokerage shares.</dd>

              <dt>Do bots trade while I&apos;m offline?</dt>
              <dd>Yes — active bots run 24/7 on the backend using the server-encrypted wallet key.</dd>

              <dt>Is this testnet?</dt>
              <dd>Yes. Default network is Robinhood Chain <strong>mainnet</strong> (chain ID 4663) — real money.</dd>

              <dt>Where are trades recorded?</dt>
              <dd>On-chain (Blockscout) and in the platform database for dashboard history.</dd>
            </dl>
          </section>

          <footer className="docs-footer">
            <Link to="/">← Back to home</Link>
            <Link to="/signup">Create account</Link>
            <Link to="/dashboard">Dashboard</Link>
          </footer>
        </article>
      </div>
    </div>
  );
}
