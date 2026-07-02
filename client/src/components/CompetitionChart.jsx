import { useMemo } from 'react';
import Character from './Character.jsx';
import { BOT_IDS } from '../lib/marketState.js';

const RANK_STYLES = [
  { label: '1ST', cls: 'rank-gold', glow: '#fbbf24' },
  { label: '2ND', cls: 'rank-silver', glow: '#94a3b8' },
  { label: '3RD', cls: 'rank-bronze', glow: '#d97706' },
  { label: '4TH', cls: 'rank-plain', glow: null },
  { label: '5TH', cls: 'rank-plain', glow: null },
];

function computeStats(panel) {
  const trades = panel.trades ?? panel.recentTrades ?? [];
  const buys = trades.filter((t) => t.side === 'buy').length;
  const sells = trades.filter((t) => t.side === 'sell').length;
  const launches = trades.filter((t) => t.side === 'launch').length;
  const sol = Number(panel.wallet?.sol ?? 0);
  const pnl = Number(panel.pnlSol ?? 0);
  const holdings = panel.holdings?.length ?? 0;
  // Competition score: P&L weighted heavily, balance + activity as tiebreakers
  const score = pnl * 100 + sol * 10 + trades.length * 0.5 + holdings * 2;
  return { trades: trades.length, buys, sells, launches, sol, pnl, holdings, score };
}

export default function CompetitionChart({ market }) {
  const ranked = useMemo(() => {
    const panels = market?.agentPanels ?? [];
    const byId = new Map(panels.map((p) => [p.id, p]));

    return BOT_IDS.map((id) => {
      const panel = byId.get(id) ?? {
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        color: '#22d3ee',
        wallet: { sol: 0, funded: false },
        pnlSol: 0,
        trades: [],
        holdings: [],
      };
      const stats = computeStats(panel);
      return { ...panel, stats };
    })
      .sort((a, b) => b.stats.score - a.stats.score);
  }, [market]);

  const maxScore = Math.max(...ranked.map((r) => Math.abs(r.stats.score)), 0.01);
  const leader = ranked[0];
  const totalTrades = ranked.reduce((s, r) => s + r.stats.trades, 0);
  const totalSol = ranked.reduce((s, r) => s + r.stats.sol, 0);

  return (
    <section className="competition-chart" aria-label="Trading competition leaderboard">
      <header className="comp-header">
        <div className="comp-header-left">
          <span className="comp-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 18h16M6 14l3-8 3 5 3-7 3 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h2 className="comp-title">COMPETITION LEADERBOARD</h2>
            <p className="comp-sub">Live rankings · P&amp;L · balance · activity</p>
          </div>
        </div>
        <div className="comp-header-stats">
          <div className="comp-stat-pill">
            <span className="comp-stat-lbl">LEADER</span>
            <span className="comp-stat-val" style={{ color: leader?.color }}>{leader?.name ?? '—'}</span>
          </div>
          <div className="comp-stat-pill">
            <span className="comp-stat-lbl">TOTAL TRADES</span>
            <span className="comp-stat-val">{totalTrades}</span>
          </div>
          <div className="comp-stat-pill">
            <span className="comp-stat-lbl">COMBINED SOL</span>
            <span className="comp-stat-val">{totalSol.toFixed(3)}</span>
          </div>
        </div>
      </header>

      <div className="comp-bars">
        {ranked.map((entry, i) => {
          const rank = RANK_STYLES[i] ?? RANK_STYLES[4];
          const pct = Math.max(4, (Math.abs(entry.stats.score) / maxScore) * 100);
          const pnlUp = entry.stats.pnl > 0;
          const pnlDown = entry.stats.pnl < 0;
          const isLeader = i === 0 && entry.stats.score > 0;

          return (
            <div
              key={entry.id}
              className={`comp-row ${isLeader ? 'comp-row-leader' : ''}`}
              style={{ '--bot-color': entry.color, '--bar-pct': `${pct}%` }}
            >
              <div className={`comp-rank ${rank.cls}`}>
                {i === 0 && entry.stats.score > 0 ? (
                  <svg className="comp-crown" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 18h20v2H2v-2zm2-8l3 4 4-6 4 6 3-4v8H4V10z" />
                  </svg>
                ) : (
                  <span className="comp-rank-num">{i + 1}</span>
                )}
              </div>

              <div className="comp-avatar">
                <Character id={entry.id} size={40} />
              </div>

              <div className="comp-info">
                <div className="comp-name-row">
                  <span className="comp-name">{entry.name}</span>
                  <span className="comp-rank-label">{rank.label}</span>
                  {!entry.wallet?.funded && (
                    <span className="comp-status comp-status-broke">UNFUNDED</span>
                  )}
                  {entry.wallet?.funded && entry.stats.trades === 0 && (
                    <span className="comp-status comp-status-idle">IDLE</span>
                  )}
                  {entry.stats.trades > 0 && (
                    <span className="comp-status comp-status-live">TRADING</span>
                  )}
                </div>

                <div className="comp-bar-track">
                  <div
                    className={`comp-bar-fill ${pnlUp ? 'up' : pnlDown ? 'down' : 'neutral'}`}
                    style={{ width: `var(--bar-pct)` }}
                  />
                  <div className="comp-bar-shine" aria-hidden="true" />
                </div>

                <div className="comp-metrics">
                  <span className={`comp-metric ${pnlUp ? 'up' : pnlDown ? 'down' : ''}`}>
                    P&amp;L <b>{entry.stats.pnl >= 0 ? '+' : ''}{entry.stats.pnl.toFixed(4)}</b>
                  </span>
                  <span className="comp-metric">
                    SOL <b>{entry.stats.sol.toFixed(4)}</b>
                  </span>
                  <span className="comp-metric">
                    TRADES <b>{entry.stats.trades}</b>
                  </span>
                  <span className="comp-metric">
                    POS <b>{entry.stats.holdings}</b>
                  </span>
                </div>
              </div>

              <div className="comp-score-block">
                <span className="comp-score-lbl">SCORE</span>
                <span className="comp-score-val">{entry.stats.score.toFixed(1)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="comp-footer">
        <span>Ranked by composite score: P&amp;L × 100 + balance × 10 + trades × 0.5 + positions × 2</span>
        <span className="comp-footer-live">
          <span className="comp-live-dot" />
          Updates live
        </span>
      </footer>
    </section>
  );
}
