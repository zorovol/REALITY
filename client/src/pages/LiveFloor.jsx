import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PlatformNav from '../components/PlatformNav.jsx';
import UserBotStation from '../components/UserBotStation.jsx';
import { IconLive, IconMarket } from '../components/Icons.jsx';
import { fetchFloorBots } from '../lib/floorApi.js';
import { BRAND } from '../config/brand.js';

export default function LiveFloor() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const list = await fetchFloorBots();
        if (alive) {
          setBots(list);
          setError('');
        }
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    const t = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const liveCount = bots.filter((b) => b.isActive).length;

  return (
    <div className="live-floor-shell">
      <div className="broadcast-bg" aria-hidden="true">
        <div className="broadcast-bg-gradient trading-bg" />
        <div className="broadcast-bg-noise" />
        <div className="trading-grid-bg" />
      </div>

      <PlatformNav />

      <div className="trading-floor-wrap">
        <div className="live-ticker live-ticker-idle">
          <IconLive size={10} />
          <span>
            {liveCount > 0
              ? `${liveCount} bot${liveCount === 1 ? '' : 's'} trading live · ${bots.length} on the floor`
              : `${bots.length} named bot${bots.length === 1 ? '' : 's'} on the floor`}
          </span>
        </div>

        <section className="trading-floor">
          <header className="tf-hero">
            <div className="tf-hero-left">
              <IconMarket size={18} />
              <div>
                <h1 className="tf-hero-title">TRADING FLOOR</h1>
                <p className="tf-hero-sub">Every named bot from the {BRAND.name} community</p>
              </div>
            </div>
            <div className="tf-hero-badges">
              <span className="tf-badge tf-badge-pump">pump.fun</span>
              <span className="tf-badge tf-badge-mainnet">SOLANA</span>
            </div>
            <p className="tf-hero-disclaimer">
              Name your bot on the dashboard to appear here. Wallet address + password login — no server signup required.
            </p>
          </header>

          {loading && !bots.length && (
            <p className="floor-empty">Loading trading floor…</p>
          )}

          {error && !bots.length && (
            <p className="floor-empty floor-error">{error}</p>
          )}

          {!loading && !bots.length && !error && (
            <div className="floor-empty floor-cta">
              <h2>No bots on the floor yet</h2>
              <p>Create a bot, give it a name, and it shows up here for everyone to see.</p>
              <Link to="/signup" className="home-v2-btn primary">Create wallet & bot</Link>
            </div>
          )}

          {bots.length > 0 && (
            <div className="tf-stations-grid user-floor-grid">
              {bots.map((bot) => (
                <UserBotStation key={bot.id} bot={bot} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
