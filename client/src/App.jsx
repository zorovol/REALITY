import { useEffect, useState, useCallback } from 'react';
import { on, getMode } from './showSource.js';
import Header from './components/Header.jsx';
import ContestantsPanel from './components/ContestantsPanel.jsx';
import DramaFeed from './components/DramaFeed.jsx';
import VotingPanel from './components/VotingPanel.jsx';
import Timeline from './components/Timeline.jsx';
import WinnerOverlay from './components/WinnerOverlay.jsx';

export default function App() {
  const [game, setGame] = useState(null);
  const [feed, setFeed] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [voting, setVoting] = useState(null);
  const [audience, setAudience] = useState(1);
  const [connected, setConnected] = useState(getMode() !== 'connecting');
  const [winner, setWinner] = useState(null);
  const [eliminatedFlash, setEliminatedFlash] = useState(null);

  useEffect(() => {
    const offs = [
      on('game:state', (state) => {
        setGame(state);
        setFeed(state.feed ?? []);
        setTimeline(state.timeline ?? []);
        setVoting(state.voting ?? null);
      }),
      on('feed:item', (item) => setFeed((prev) => [...prev.slice(-160), item])),
      on('timeline:item', (item) => setTimeline((prev) => [...prev.slice(-120), item])),
      on('phase:change', ({ phase, endsAt, episode, season }) =>
        setGame((g) => (g ? { ...g, phase, phaseEndsAt: endsAt, episode, season } : g))
      ),
      on('vote:open', (v) => setVoting(v)),
      on('vote:update', (v) => setVoting(v)),
      on('vote:closed', () => setVoting((v) => (v ? { ...v, closed: true } : v))),
      on('audience:count', (n) => setAudience(n)),
      on('season:winner', (w) => {
        setWinner(w);
        setTimeout(() => setWinner(null), 9000);
      }),
      on('contestant:eliminated', ({ id, name }) => {
        setEliminatedFlash({ id, name });
        setTimeout(() => setEliminatedFlash(null), 4000);
      }),
      on('source:change', ({ connected: isUp }) => setConnected(isUp)),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const contestantById = useCallback(
    (id) => game?.contestants?.find((c) => c.id === id),
    [game]
  );

  if (!game) {
    return (
      <div className="boot-screen">
        <div className="boot-logo">🌴</div>
        <h1 className="boot-title">AI DRAMA ISLAND</h1>
        <p className="boot-sub">{connected ? 'Tuning into the broadcast…' : 'Connecting to the island…'}</p>
        <div className="boot-bar"><div className="boot-bar-fill" /></div>
      </div>
    );
  }

  return (
    <div className={`app phase-${game.phase}`}>
      <div className="bg-aurora" aria-hidden="true" />
      <Header game={game} audience={audience} connected={connected} />
      <main className="layout">
        <ContestantsPanel contestants={game.contestants} eliminatedFlash={eliminatedFlash} />
        <DramaFeed feed={feed} phase={game.phase} />
        <VotingPanel voting={voting} phase={game.phase} contestantById={contestantById} />
      </main>
      <Timeline items={timeline} season={game.season} />
      {winner && <WinnerOverlay winner={winner} />}
    </div>
  );
}
