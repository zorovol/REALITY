import { useEffect, useState, useCallback } from 'react';
import { on, getMode } from './showSource.js';
import Header from './components/Header.jsx';
import ContestantsPanel from './components/ContestantsPanel.jsx';
import MapStage from './components/MapStage.jsx';
import DramaFeed from './components/DramaFeed.jsx';
import VotingPanel from './components/VotingPanel.jsx';
import Timeline from './components/Timeline.jsx';

export default function App() {
  const [world, setWorld] = useState(null);
  const [feed, setFeed] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [voting, setVoting] = useState(null);
  const [audience, setAudience] = useState(1);
  const [connected, setConnected] = useState(getMode() !== 'connecting');
  const [eliminatedFlash, setEliminatedFlash] = useState(null);

  useEffect(() => {
    const offs = [
      on('world:state', (state) => {
        setWorld(state);
        setFeed(state.feed ?? []);
        setTimeline(state.timeline ?? []);
        setVoting(state.voting ?? null);
      }),
      on('feed:item', (item) => setFeed((prev) => [...prev.slice(-160), item])),
      on('timeline:item', (item) => setTimeline((prev) => [...prev.slice(-120), item])),
      on('arc:change', (arc) => setWorld((w) => (w ? { ...w, arc } : w))),
      on('agent:state', (agent) =>
        setWorld((w) => w
          ? { ...w, agents: w.agents.map((a) => (a.id === agent.id ? agent : a)) }
          : w)
      ),
      on('vote:open', (v) => setVoting(v)),
      on('vote:update', (v) => setVoting(v)),
      on('vote:closed', () => setVoting((v) => (v ? { ...v, closed: true } : v))),
      on('audience:count', (n) => setAudience(n)),
      on('agent:eliminated', ({ id, name }) => {
        setEliminatedFlash({ id, name });
        setTimeout(() => setEliminatedFlash(null), 4000);
      }),
      on('source:change', ({ connected: isUp }) => setConnected(isUp)),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const agentById = useCallback(
    (id) => world?.agents?.find((a) => a.id === id),
    [world]
  );

  if (!world) {
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
    <div className="app">
      <div className="bg-aurora" aria-hidden="true" />
      <Header world={world} audience={audience} connected={connected} votingLive={!!voting && !voting.closed} />
      <main className="layout">
        <ContestantsPanel agents={world.agents} eliminatedFlash={eliminatedFlash} agentById={agentById} />
        <div className="center-stack">
          <MapStage agents={world.agents} zones={world.zones} tension={world.tension ?? 0} />
          <DramaFeed feed={feed} arc={world.arc} />
        </div>
        <VotingPanel voting={voting} contestantById={agentById} />
      </main>
      <Timeline items={timeline} arc={world.arc} />
    </div>
  );
}
