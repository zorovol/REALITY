import { useEffect, useMemo, useState } from 'react';
import { castVote } from '../showSource.js';
import Character from './Character.jsx';
import { IconVote, IconSkull } from './Icons.jsx';

function useCountdown(endsAt) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [endsAt]);
  return left;
}

export default function VotingPanel({ voting, contestantById }) {
  const [selected, setSelected] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [error, setError] = useState('');
  const left = useCountdown(voting?.endsAt);
  const open = voting && !voting.closed && left > 0;

  useEffect(() => {
    setSelected(null);
    setMyVote(null);
    setError('');
  }, [voting?.id]);

  const rows = useMemo(() => {
    if (!voting) return [];
    const total = Math.max(1, voting.totalVotes);
    return voting.candidateIds
      .map((id) => {
        const c = contestantById(id);
        const count = voting.counts[id] ?? 0;
        return c ? { c, count, pct: Math.round((count / total) * 100) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count);
  }, [voting, contestantById]);

  const submit = () => {
    if (!selected || !open) return;
    castVote(selected, (res) => {
      if (res?.ok) { setMyVote(selected); setError(''); }
      else setError(res?.error ?? 'Vote failed.');
    });
  };

  return (
    <aside className="vote-panel">
      <header className="panel-head">
        <span className="panel-head-title">AUDIENCE VOTE</span>
        {open && <span className={`vote-countdown ${left <= 10 ? 'urgent' : ''}`}>{left}s</span>}
      </header>

      {!voting && (
        <div className="vote-idle">
          <div className="vote-idle-icon"><IconVote size={32} /></div>
          <p className="vote-idle-title">Standing by</p>
          <p className="vote-idle-sub">The Director calls a vote when island tension peaks. Your ballot is weighed against the cast.</p>
        </div>
      )}

      {voting && (
        <div className="vote-body">
          <div className="vote-mode">
            <IconSkull size={14} />
            <span>VOTE TO ELIMINATE</span>
          </div>
          <div className="vote-rows">
            {rows.map(({ c, count, pct }) => (
              <button
                key={c.id}
                type="button"
                className={`vote-row ${selected === c.id ? 'selected' : ''} ${myVote === c.id ? 'locked' : ''}`}
                style={{ '--accent': c.color }}
                disabled={!open}
                onClick={() => setSelected(c.id)}
              >
                <Character id={c.id} size={30} mood={c.mood} />
                <span className="vote-row-name">{c.name}</span>
                <span className="vote-row-pct">{pct}%</span>
                <span className="vote-row-bar" style={{ width: `${pct}%` }} />
              </button>
            ))}
          </div>
          <button type="button" className="vote-submit" disabled={!open || !selected || myVote === selected} onClick={submit}>
            {!open ? 'VOTING CLOSED' : myVote === selected ? 'VOTE LOCKED' : myVote ? 'CHANGE VOTE' : 'CAST VOTE'}
          </button>
          {error && <p className="vote-error">{error}</p>}
          <p className="vote-total">{voting.totalVotes} ballot{voting.totalVotes === 1 ? '' : 's'} cast</p>
        </div>
      )}
    </aside>
  );
}
