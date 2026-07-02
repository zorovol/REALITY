import { useEffect, useState, useCallback } from 'react';
import { socket } from './socket.js';
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
  const [connected, setConnected] = useState(socket.connected);
  const [winner, setWinner] = useState(null);
  const [eliminatedFlash, setEliminatedFlash] = useState(null);

  useEffect(() => {
    const onState = (state) => {
      setGame(state);
      setFeed(state.feed ?? []);
      setTimeline(state.timeline ?? []);
      setVoting(state.voting ?? null);
    };
    const onFeed = (item) => setFeed((prev) => [...prev.slice(-160), item]);
    const onTimeline = (item) => setTimeline((prev) => [...prev.slice(-120), item]);
    const onPhase = ({ phase, endsAt, episode, season }) =>
      setGame((g) => (g ? { ...g, phase, phaseEndsAt: endsAt, episode, season } : g));
    const onVoteOpen = (v) => setVoting(v);
    const onVoteUpdate = (v) => setVoting(v);
    const onVoteClosed = () => setVoting((v) => (v ? { ...v, closed: true } : v));
    const onAudience = (n) => setAudience(n);
    const onWinner = (w) => {
      setWinner(w);
      setTimeout(() => setWinner(null), 9000);
    };
    const onEliminated = ({ id, name }) => {
      setEliminatedFlash({ id, name });
      setTimeout(() => setEliminatedFlash(null), 4000);
    };

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('game:state', onState);
    socket.on('feed:item', onFeed);
    socket.on('timeline:item', onTimeline);
    socket.on('phase:change', onPhase);
    socket.on('vote:open', onVoteOpen);
    socket.on('vote:update', onVoteUpdate);
    socket.on('vote:closed', onVoteClosed);
    socket.on('audience:count', onAudience);
    socket.on('season:winner', onWinner);
    socket.on('contestant:eliminated', onEliminated);

    return () => {
      socket.off('game:state', onState);
      socket.off('feed:item', onFeed);
      socket.off('timeline:item', onTimeline);
      socket.off('phase:change', onPhase);
      socket.off('vote:open', onVoteOpen);
      socket.off('vote:update', onVoteUpdate);
      socket.off('vote:closed', onVoteClosed);
      socket.off('audience:count', onAudience);
      socket.off('season:winner', onWinner);
      socket.off('contestant:eliminated', onEliminated);
    };
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
