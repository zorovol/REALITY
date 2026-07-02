import { useEffect, useMemo, useState } from 'react';
import { on, getMode } from './showSource.js';
import { ensureMarket } from './lib/marketState.js';
import Header from './components/Header.jsx';
import TradingFloor from './components/TradingFloor.jsx';
import BootScreen from './components/BootScreen.jsx';

export default function App() {
  const [world, setWorld] = useState(null);
  const [market, setMarket] = useState(null);
  const [audience, setAudience] = useState(1);
  const [source, setSource] = useState({ mode: getMode(), connected: false, booted: false });

  useEffect(() => {
    const offs = [
      on('world:state', (state) => {
        setWorld(state);
        setMarket((prev) => ensureMarket(state.market ?? prev, state));
      }),
      on('audience:count', (n) => setAudience(n)),
      on('source:change', (payload) => setSource(payload)),
      on('market:update', (m) => {
        setWorld((w) => {
          const merged = ensureMarket(m, w);
          setMarket(merged);
          if (m.wallets && w) {
            return { ...w, agents: w.agents.map((a) => ({ ...a, wallet: m.wallets[a.id] ?? a.wallet })) };
          }
          return w;
        });
      }),
      on('trade:item', (trade) => {
        setMarket((prev) => {
          const base = ensureMarket(prev, world);
          const panels = (base.agentPanels ?? []).map((p) => {
            if (p.id !== trade.agentId) return p;
            const trades = [trade, ...(p.trades ?? p.recentTrades ?? [])];
            return { ...p, trades, recentTrades: trades };
          });
          return {
            ...base,
            recentTrades: [...(base.recentTrades ?? []), trade].slice(-100),
            agentPanels: panels,
            tradesByAgent: {
              ...(base.tradesByAgent ?? {}),
              [trade.agentId]: [trade, ...(base.tradesByAgent?.[trade.agentId] ?? [])],
            },
          };
        });
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const effectiveMarket = useMemo(
    () => ensureMarket(market, world),
    [market, world],
  );

  if (!world) {
    return (
      <BootScreen
        connected={source.connected}
        mode={source.mode}
        reason={source.reason}
        error={source.error}
      />
    );
  }

  return (
    <div className="trading-app">
      {source.mode === 'local' && (
        <div className="trading-mode-banner" role="status">
          Connection failed — running local mode. Live trades require the server.
        </div>
      )}

      <div className="broadcast-bg" aria-hidden="true">
        <div className="broadcast-bg-gradient trading-bg" />
        <div className="broadcast-bg-noise" />
        <div className="broadcast-bg-vignette" />
        <div className="trading-grid-bg" aria-hidden="true" />
        <div className="trading-scanline" aria-hidden="true" />
      </div>

      <Header market={effectiveMarket} audience={audience} connected={source.connected || source.mode === 'local'} />
      <main className="trading-main">
        <TradingFloor market={effectiveMarket} />
      </main>
    </div>
  );
}
