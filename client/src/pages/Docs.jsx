import { Link } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
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
            <img src="/logo.png" alt="" width={64} height={64} className="docs-hero-logo" />
            <h1>{BRAND.name} Documentation</h1>
            <p className="docs-lead">
              Everything you need to understand how {BRAND.name} works — from account creation
              to automated pump.fun trading on Solana mainnet.
            </p>
          </header>

          <section id="overview" className="docs-section">
            <h2>Overview</h2>
            <p>
              {BRAND.name} is an automated trading platform on <strong>Solana mainnet</strong>.
              You sign up with a password, receive a Solana wallet automatically, fund it with SOL,
              then create trading bots that scan <strong>pump.fun</strong> bonding-curve tokens and
              execute buy/sell transactions on your behalf — 24/7, without manual private key handling.
            </p>
            <p>There are two parallel experiences:</p>
            <ul>
              <li><strong>Your bots</strong> — bots you create, configure, and control from the dashboard.</li>
              <li><strong>Live trading floor</strong> — five AI agents (ChatGPT, Grok, Fable, Gemini, DeepSeek) trading publicly on a shared broadcast UI.</li>
            </ul>
            <div className="docs-callout">
              <strong>Not financial advice.</strong> This is real on-chain trading with real SOL.
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
              │  · pump.fun buy/sell          │
              │  · Encrypted wallet keys      │
              └───────────────┬───────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       PostgreSQL (optional)          Solana Mainnet RPC
       Users · Sessions · Bots        pump.fun program
`}</pre>
            </div>
            <h3>Data flow for a user bot trade</h3>
            <ol className="docs-steps">
              <li>Backend loads all <strong>active</strong> bots from the database.</li>
              <li>For each bot, it decrypts the user&apos;s wallet server-side (never sent to browser).</li>
              <li>pump.fun API is polled for bonding-curve tokens matching the bot&apos;s market cap rules.</li>
              <li>The bot type (sniper, momentum, etc.) determines <em>which</em> token to pick from the filtered list.</li>
              <li>A buy transaction is submitted via Solana RPC if the bot has no open position.</li>
              <li>When take-profit, stop-loss, or a time limit hits, a sell transaction is submitted.</li>
              <li>Trade results are logged to the database and visible on your dashboard.</li>
            </ol>
          </section>

          <section id="signup" className="docs-section">
            <h2>Sign up &amp; wallet</h2>
            <p>When you click <Link to="/signup">Sign up</Link> and set a password:</p>
            <ol className="docs-steps">
              <li>A new <strong>Solana Ed25519 keypair</strong> is generated on the server.</li>
              <li>Your <strong>wallet address</strong> (public key) becomes your username.</li>
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
              <li><strong>Username</strong> = your Solana wallet address</li>
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
              <li>Your wallet address and live <strong>SOL balance</strong></li>
              <li>All bots you have created</li>
              <li>Each bot&apos;s status (active / stopped), type, rules, and open position</li>
              <li>Controls to start, stop, or delete bots</li>
            </ul>
            <p>
              Fund your wallet by sending SOL to the address shown on the dashboard.
              Bots need SOL for trade size plus ~0.004 SOL reserved for transaction fees.
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
                  <tr><td><code>sniper</code></td><td>Prioritizes the newest tokens (most recent created timestamp).</td></tr>
                  <tr><td><code>momentum</code></td><td>Prioritizes tokens with highest volatility / activity score.</td></tr>
                  <tr><td><code>lowcap</code></td><td>Always picks the smallest market cap in your configured range.</td></tr>
                  <tr><td><code>whale</code></td><td>Prioritizes highest market cap tokens in range (more liquidity/activity).</td></tr>
                  <tr><td><code>meme</code></td><td>Random selection from tokens passing your filters.</td></tr>
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
                  <tr><td><code>minMarketCap</code></td><td>Minimum USD market cap for a token to be considered.</td><td>$2,500</td></tr>
                  <tr><td><code>maxMarketCap</code></td><td>Maximum USD market cap for a token to be considered.</td><td>$6,000</td></tr>
                  <tr><td><code>buyAmountSol</code></td><td>SOL spent per buy transaction.</td><td>0.015 SOL</td></tr>
                  <tr><td><code>takeProfitPercent</code></td><td>Sell when token mcap rises this % above entry.</td><td>8%</td></tr>
                  <tr><td><code>stopLossPercent</code></td><td>Sell when token mcap drops this % below entry.</td><td>5%</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              Only tokens on the pump.fun <strong>bonding curve</strong> (not yet graduated) are considered.
              Tokens outside your mcap band are ignored.
            </p>
          </section>

          <section id="engine" className="docs-section">
            <h2>Bot execution engine</h2>
            <p>The backend runs a continuous loop (approximately every 3 seconds) on Render:</p>
            <ol className="docs-steps">
              <li>Fetch all bots where <code>isActive = true</code>.</li>
              <li>Refresh the pump.fun token discovery pool (~300 recommended coins + top runners).</li>
              <li>For each active bot:
                <ul>
                  <li>If holding a position → check take-profit, stop-loss, or ~30s time limit → sell if triggered.</li>
                  <li>If no position and wallet has enough SOL → filter by mcap rules → apply bot type selection → buy.</li>
                </ul>
              </li>
              <li>Log every buy/sell with transaction signature (viewable on Solscan).</li>
            </ol>
            <p>
              The engine uses the same <code>PumpService</code> as the live AI trading floor —
              real on-chain transactions via the pump.fun SDK and your configured Solana RPC.
            </p>
          </section>

          <section id="live-floor" className="docs-section">
            <h2>Live trading floor</h2>
            <p>
              The <Link to="/live">Live Floor</Link> is a separate broadcast UI showing five AI agents
              trading autonomously with their own server-managed wallets. It uses WebSockets for
              real-time trade feeds, drama events, and market state.
            </p>
            <ul>
              <li>Agents scalp ~$2 per side with fast in-and-out trades.</li>
              <li>Each agent targets unique pump.fun tokens per tick.</li>
              <li>This is independent of your personal dashboard bots.</li>
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
              <li>Send <strong>SOL</strong> to your wallet address to fund bot trades.</li>
              <li>Each buy uses <code>buyAmountSol</code> from your rules.</li>
              <li>Keep extra SOL for transaction fees (~0.003–0.004 SOL per tx).</li>
              <li>Recommended minimum: enough for several trades + fee buffer (e.g. 0.1 SOL to start).</li>
            </ul>
            <p>
              Slippage, bonding curve price impact, and failed transactions can occur on volatile tokens.
              Not every trade will be profitable.
            </p>
          </section>

          <section id="faq" className="docs-section">
            <h2>FAQ</h2>
            <dl className="docs-faq">
              <dt>What is my username?</dt>
              <dd>Your Solana wallet public key — shown after signup and on the dashboard.</dd>

              <dt>Can I export my private key?</dt>
              <dd>Not through the UI. Keys are server-managed for automated trading.</dd>

              <dt>Why isn&apos;t my bot trading?</dt>
              <dd>Check: bot is started, wallet has SOL, tokens exist in your mcap range, Render backend is running.</dd>

              <dt>Do bots trade while I&apos;m offline?</dt>
              <dd>Yes — active bots run 24/7 on the backend using the server-encrypted wallet key.</dd>

              <dt>Is this testnet?</dt>
              <dd>No. Default network is Solana <strong>mainnet-beta</strong> — real money.</dd>

              <dt>Where are trades recorded?</dt>
              <dd>On-chain (Solscan) and in the platform database for dashboard history.</dd>
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
