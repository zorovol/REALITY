import { useState } from 'react';
import { IconMarket, IconTrade } from './Icons.jsx';

function TradeRow({ trade }) {
  const sideLabel = trade.side === 'launch' ? 'LAUNCH' : trade.side?.toUpperCase() ?? 'TX';
  const sideCls = trade.side === 'sell' ? 'sell' : trade.side === 'launch' ? 'launch' : 'buy';
  return (
    <div className={`market-trade market-trade-${sideCls}`}>
      <span className={`market-trade-side market-side-${sideCls}`}>{sideLabel}</span>
      <span className="market-trade-agent">{trade.agentName}</span>
      <span className="market-trade-detail">
        {trade.symbol ? `$${trade.symbol}` : ''}
        {trade.solAmount != null ? ` ${Number(trade.solAmount).toFixed(3)} SOL` : ''}
      </span>
      {trade.explorerUrl && (
        <a className="market-trade-link" href={trade.explorerUrl} target="_blank" rel="noopener noreferrer">
          TX
        </a>
      )}
    </div>
  );
}

export default function MarketFloor({ market }) {
  const [tab, setTab] = useState('trades');
  if (!market) return null;

  const tokens = Object.entries(market.islandTokens ?? {});
  const trades = market.recentTrades ?? [];

  return (
    <section className="market-panel">
      <header className="panel-head market-head">
        <IconMarket size={14} />
        <span className="panel-head-title">ISLAND DEX</span>
        <span className={`market-mode ${market.mode === 'real' ? 'real' : 'sim'}`}>
          {market.mode === 'real' ? 'ON-CHAIN' : 'DEV'}
        </span>
      </header>

      <p className="market-disclaimer">{market.disclaimer}</p>

      <div className="market-tabs">
        <button type="button" className={tab === 'trades' ? 'on' : ''} onClick={() => setTab('trades')}>
          <IconTrade size={12} />
          TRADES
        </button>
        <button type="button" className={tab === 'tokens' ? 'on' : ''} onClick={() => setTab('tokens')}>
          TOKENS
        </button>
      </div>

      <div className="market-scroll">
        {tab === 'trades' && (
          trades.length ? trades.slice().reverse().map((t) => <TradeRow key={t.id} trade={t} />)
            : <p className="market-empty">No on-chain trades yet. Fund agent wallets to start.</p>
        )}
        {tab === 'tokens' && (
          tokens.length ? tokens.map(([agentId, mint]) => (
            <div key={agentId} className="market-token-row">
              <span className="market-token-agent">{agentId}</span>
              <span className="market-token-mint" title={mint}>{mint.slice(0, 6)}…{mint.slice(-4)}</span>
            </div>
          ))
            : <p className="market-empty">No island tokens launched yet.</p>
        )}
      </div>
    </section>
  );
}
