export default function WinnerOverlay({ winner }) {
  return (
    <div className="winner-overlay">
      <div className="winner-card glass">
        <div className="winner-crown">👑</div>
        <div className="winner-avatar">{winner.avatar}</div>
        <h2 className="winner-name">{winner.winner}</h2>
        <p className="winner-sub">WINS AI DRAMA ISLAND — SEASON {winner.season}</p>
        <div className="winner-confetti" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} style={{ '--i': i }} />
          ))}
        </div>
      </div>
    </div>
  );
}
