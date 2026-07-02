import { useEffect, useMemo, useState } from 'react';
import { castVote } from '../showSource.js';

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

export default function VotingPanel({ voting, phase, contestantById }) {
  const [selected, setSelected] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [error, setError] = useState('');
  const left = useCountdown(voting?.endsAt);
  const open = phase === 'voting' && voting && !voting.closed && left > 0;

  useEffect(() => {
    // Reset local choice when a new vote opens
    setSelected(null);
    setMyVote(null);
    setError('');
  }, [voting?.episode, voting?.mode]);

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
      if (res?.ok) {
        setMyVote(selected);
        setError('');
      } else {
        setError(res?.error ?? 'Vote failed.');
      }
    });
  };

  return (
    <aside className="panel glass voting-panel">
      <h2 className="panel-title">
        <span>AUDIENCE VOTE</span>
        {open && <span className={`vote-timer ${left <= 10 ? 'urgent' : ''}`}>{left}s</span>}
      </h2>

      {!voting && (
        <div className="voting-idle">
          <div className="idle-icon">🗳️</div>
          <p>Voting opens during the <b>Voting Phase</b> of every episode.</p>
          <p className="idle-sub">Your vote is weighed against the island's own votes — you can change history.</p>
        </div>
      )}

      {voting && (
        <>
          <div className={`vote-mode-tag ${voting.mode}`}>
            {voting.mode === 'save' ? '💙 VOTE TO SAVE' : '☠️ VOTE TO ELIMINATE'}
          </div>
          <div className="vote-list">
            {rows.map(({ c, count, pct }) => (
              <button
                key={c.id}
                className={`vote-row ${selected === c.id ? 'selected' : ''} ${myVote === c.id ? 'voted' : ''}`}
                style={{ '--accent': c.color }}
                disabled={!open}
                onClick={() => setSelected(c.id)}
              >
                <span className="vote-avatar">{c.avatar}</span>
                <span className="vote-name">{c.name}</span>
                <span className="vote-pct">{pct}%</span>
                <span className="vote-count">{count}</span>
                <span className="vote-bar" style={{ width: `${pct}%` }} />
              </button>
            ))}
          </div>
          <button className="submit-vote" disabled={!open || !selected || myVote === selected} onClick={submit}>
            {!open ? 'VOTING CLOSED' : myVote === selected && myVote ? '✓ VOTE LOCKED IN' : myVote ? 'CHANGE VOTE' : 'SUBMIT VOTE'}
          </button>
          {error && <div className="vote-error">{error}</div>}
          <div className="vote-total">{voting.totalVotes} audience vote{voting.totalVotes === 1 ? '' : 's'} cast</div>
        </>
      )}
    </aside>
  );
}
