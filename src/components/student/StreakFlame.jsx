export default function StreakFlame({ streak, onInfoClick }) {
  return (
    <div className={`streak-pill ${streak > 0 ? 'streak-pill--lit' : ''}`}>
      <span className="streak-flame">🔥</span>
      <div className="streak-text">
        <span className="streak-count">{streak}</span>
        <span className="streak-label">day streak</span>
      </div>
      {onInfoClick && (
        <button type="button" className="info-badge" onClick={onInfoClick} aria-label="What is the day streak?">
          ?
        </button>
      )}
    </div>
  )
}
