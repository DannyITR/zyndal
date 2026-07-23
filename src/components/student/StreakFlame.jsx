export default function StreakFlame({ streak }) {
  return (
    <div className={`streak-pill ${streak > 0 ? 'streak-pill--lit' : ''}`}>
      <span className="streak-flame">🔥</span>
      <div className="streak-text">
        <span className="streak-count">{streak}</span>
        <span className="streak-label">day streak</span>
      </div>
    </div>
  )
}
