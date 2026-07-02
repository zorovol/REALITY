import { useEffect, useRef, useState } from 'react';
import Character from './Character.jsx';
import CompetitionChart from './CompetitionChart.jsx';
import { IconMarket, IconCopy, IconLive } from './Icons.jsx';
import { BOT_IDS } from '../lib/marketState.js';

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function CopyAddr({ address, prominent }) {
  const [copied, setCopied] = useState(false);
  if (!address || address.startsWith('sim-')) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <button
      type="button"
      className={`tf-copy-btn ${prominent ? 'tf-copy-prominent' : ''}`}
      onClick={copy}
      title={address}
    >
      <span className="tf-addr-full">{address}</span>
      <span className="tf-addr-short">{address.slice(0, 6)}…{address.slice(-6)}</span>
      <IconCopy size={11} />
      <span className="tf-copy-label">{copied ? 'COPIED' : 'COPY'}</span>
    </button>
  );
}

function TradeRow({ trade, isNew }) {
  const sym = trade.symbol?.startsWith('$') ? trade.symbol : trade.symbol ? `$${trade.symbol}` : '—';
  return (
    <li className={`tf-log-row tf-log-${trade.side} ${isNew ? 'tf-log-new' : ''}`}>
      <span className="tf-log-time">{formatTime(trade.ts)}</span>
      <span className={`tf-log-side tf-side-${trade.side}`}>{trade.side?.toUpperCase()}</span>
      <span className="tf-log-token">{sym}</span>
      <span className="tf-log-sol">
        {trade.solAmount != null ? `${Number(trade.solAmount).toFixed(4)} SOL` : '—'}
      </span>
      {trade.explorerUrl ? (
        <a href={trade.explorerUrl} target="_blank" rel="noopener noreferrer" className="tf-log-tx">
          {trade.signature?.slice(0, 6)}…
        </a>
      ) : (
        <span className="tf-log-tx-pending">pending</span>
      )}
    </li>
  );
}

function AgentStation({ panel, newTradeIds }) {
  const logRef = useRef(null);
  const [balancePulse, setBalancePulse] = useState(false);
  const prevBal = useRef(panel.wallet?.sol);
  const unfunded = panel.positionStatus === 'unfunded';
  const pnlUp = panel.pnlSol > 0;
  const pnlDown = panel.pnlSol < 0;
  const trades = panel.trades ?? panel.recentTrades ?? [];

  useEffect(() => {
    if (prevBal.current !== panel.wallet?.sol) {
      setBalancePulse(true);
      prevBal.current = panel.wallet?.sol;
      const t = setTimeout(() => setBalancePulse(false), 1200);
      return () => clearTimeout(t);
    }
  }, [panel.wallet?.sol]);

  useEffect(() => {
    if (logRef.current && newTradeIds.has(trades[0]?.id)) {
      logRef.current.scrollTop = 0;
    }
  }, [trades, newTradeIds]);

  return (
    <article className={`tf-station ${unfunded ? 'tf-station-unfunded' : ''}`} style={{ '--station-accent': panel.color }}>
      <div className="tf-station-glow" aria-hidden="true" />
      <div className="tf-station-border" aria-hidden="true" />

      <header className="tf-station-head">
        <div className="tf-station-portrait">
          <Character id={panel.id} size={72} pulse={balancePulse} />
        </div>
        <div className="tf-station-identity">
          <h2 className="tf-station-name">{panel.name}</h2>
          <p className="tf-station-tagline">{panel.tagline}</p>
          <span className="tf-station-model">{panel.modelLabel}</span>
        </div>
        <div className={`tf-station-pnl ${pnlUp ? 'up' : pnlDown ? 'down' : ''}`}>
          <span className="tf-pnl-lbl">P&L</span>
          <span className="tf-pnl-num">{panel.pnlSol >= 0 ? '+' : ''}{panel.pnlSol}</span>
        </div>
      </header>

      <div className="tf-station-wallet">
        <div className="tf-balance-block">
          <span className="tf-balance-lbl">SOL BALANCE</span>
          <span className={`tf-balance-val ${panel.wallet?.funded ? 'funded' : 'empty'} ${balancePulse ? 'tf-balance-pulse' : ''}`}>
            {panel.wallet?.sol ?? 0}
            <small>SOL</small>
          </span>
        </div>
        {unfunded ? (
          <div className="tf-fund-prompt">
            <span className="tf-fund-label">AWAITING FUNDING</span>
            <p className="tf-fund-text">Send SOL to this wallet to enable pump.fun trading</p>
            <CopyAddr address={panel.wallet?.address} prominent />
          </div>
        ) : (
          <CopyAddr address={panel.wallet?.address} />
        )}
      </div>

      <div className="tf-station-holdings">
        <span className="tf-block-label">OPEN POSITIONS</span>
        {panel.holdings?.length > 0 ? (
          <ul className="tf-holdings-list">
            {panel.holdings.map((h) => (
              <li key={h.mint} className="tf-holding">
                <span className="tf-holding-sym">{h.symbol}</span>
                <span className="tf-holding-cost">{Number(h.costSol ?? 0).toFixed(3)} SOL</span>
                {h.own && <span className="tf-holding-own">OWN</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="tf-station-empty">No positions</p>
        )}
        {panel.islandToken && (
          <div className="tf-launched" title={panel.islandToken.mint}>
            Launched ${panel.islandToken.symbol}
          </div>
        )}
      </div>

      <div className="tf-station-log">
        <span className="tf-block-label">TRADE LOG</span>
        <ul className="tf-log-list" ref={logRef}>
          {trades.length > 0 ? (
            trades.map((t) => (
              <TradeRow key={t.id} trade={t} isNew={newTradeIds.has(t.id)} />
            ))
          ) : (
            <li className="tf-station-empty tf-log-empty">
              {unfunded ? 'Fund wallet to start trading' : 'No trades yet — watching pump.fun'}
            </li>
          )}
        </ul>
      </div>
    </article>
  );
}

function LiveTicker({ trades }) {
  const items = [...(trades ?? [])].reverse().slice(0, 12);
  if (!items.length) {
    return (
      <div className="live-ticker live-ticker-idle">
        <IconLive size={10} />
        <span>LIVE TRADES — waiting for on-chain activity</span>
      </div>
    );
  }

  const line = items.map((t) => {
    const sym = t.symbol ? (t.symbol.startsWith('$') ? t.symbol : `$${t.symbol}`) : 'TOKEN';
    const sol = t.solAmount != null ? `${Number(t.solAmount).toFixed(3)} SOL` : '';
    return `${t.agentName} ${t.side?.toUpperCase()} ${sym} ${sol}`.trim();
  }).join('  ·  ');

  return (
    <div className="live-ticker">
      <span className="live-ticker-badge">
        <IconLive size={10} />
        LIVE
      </span>
      <div className="live-ticker-track">
        <span className="live-ticker-text">{line}</span>
        <span className="live-ticker-text" aria-hidden="true">{line}</span>
      </div>
    </div>
  );
}

export default function TradingFloor({ market }) {
  const panels = market?.agentPanels ?? [];
  const [newTradeIds, setNewTradeIds] = useState(new Set());
  const seenRef = useRef(new Set());

  const displayPanels = panels.length >= BOT_IDS.length
    ? panels
    : BOT_IDS.map((id) => panels.find((p) => p.id === id)).filter(Boolean);

  useEffect(() => {
    const allTrades = panels.flatMap((p) => p.trades ?? p.recentTrades ?? []);
    const fresh = new Set();
    for (const t of allTrades) {
      if (!seenRef.current.has(t.id)) {
        fresh.add(t.id);
        seenRef.current.add(t.id);
      }
    }
    if (fresh.size > 0) {
      setNewTradeIds(fresh);
      const timer = setTimeout(() => setNewTradeIds(new Set()), 3000);
      return () => clearTimeout(timer);
    }
  }, [panels]);

  return (
    <div className="trading-floor-wrap">
      <LiveTicker trades={market?.recentTrades} />

      <section className="trading-floor">
        <header className="tf-hero">
          <div className="tf-hero-left">
            <IconMarket size={18} />
            <div>
              <h1 className="tf-hero-title">AI TRADING FLOOR</h1>
              <p className="tf-hero-sub">5 AI models · pump.fun · Solana mainnet</p>
            </div>
          </div>
          <div className="tf-hero-badges">
            <span className="tf-badge tf-badge-mainnet">MAINNET</span>
            <span className="tf-badge tf-badge-pump">pump.fun</span>
            <span className={`tf-badge tf-badge-mode ${market?.mode === 'real' ? 'real' : 'dev'}`}>
              {market?.mode === 'real' ? 'ON-CHAIN' : 'DEV'}
            </span>
          </div>
          <p className="tf-hero-disclaimer">{market?.disclaimer}</p>
        </header>

        <div className="tf-stations-grid">
          {displayPanels.length >= BOT_IDS.length
            ? displayPanels.map((p) => (
              <AgentStation key={p.id} panel={p} newTradeIds={newTradeIds} />
            ))
            : BOT_IDS.map((id) => (
              <article key={id} className="tf-station tf-station-skeleton">
                <p className="tf-station-empty">Loading {id}…</p>
              </article>
            ))}
        </div>

        <CompetitionChart market={market} />
      </section>
    </div>
  );
}
