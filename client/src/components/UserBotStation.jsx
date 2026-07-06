import Character from './Character.jsx';
import { botMeta } from '../lib/botTypes.js';

export default function UserBotStation({ bot }) {
  const meta = botMeta(bot.botType);

  return (
    <article
      className={`tf-station user-bot-station ${bot.isActive ? 'is-live' : ''}`}
      style={{ '--station-accent': meta.color }}
    >
      <div className="tf-station-glow" aria-hidden="true" />
      <div className="tf-station-border" aria-hidden="true" />

      <header className="tf-station-head">
        <div className="tf-station-portrait">
          <Character id={bot.botType} size={72} pulse={bot.isActive} />
        </div>
        <div className="tf-station-identity">
          <h2 className="tf-station-name">{bot.name}</h2>
          <p className="tf-station-tagline">{meta.label} bot</p>
          <span className="tf-station-model">
            {bot.walletAddress.slice(0, 4)}…{bot.walletAddress.slice(-4)}
          </span>
        </div>
        <div className={`tf-station-pnl user-bot-status ${bot.isActive ? 'up' : ''}`}>
          <span className="tf-pnl-lbl">STATUS</span>
          <span className="tf-pnl-num">{bot.isActive ? 'LIVE' : 'IDLE'}</span>
        </div>
      </header>

      <div className="tf-station-holdings">
        <span className="tf-block-label">RULES</span>
        <ul className="tf-holdings-list user-bot-rules">
          <li className="tf-holding">
            <span className="tf-holding-sym">MCap</span>
            <span className="tf-holding-cost">
              ${bot.tradingRules?.minMarketCap?.toLocaleString()} – ${bot.tradingRules?.maxMarketCap?.toLocaleString()}
            </span>
          </li>
          <li className="tf-holding">
            <span className="tf-holding-sym">Buy</span>
            <span className="tf-holding-cost">{bot.tradingRules?.buyAmountSol} SOL</span>
          </li>
          <li className="tf-holding">
            <span className="tf-holding-sym">TP / SL</span>
            <span className="tf-holding-cost">
              {bot.tradingRules?.takeProfitPercent}% / {bot.tradingRules?.stopLossPercent}%
            </span>
          </li>
        </ul>
        {bot.position && (
          <div className="tf-launched">
            Holding ${bot.position.symbol ?? 'token'}
          </div>
        )}
      </div>
    </article>
  );
}
