export default function StatPill({ icon, label, value, onInfoClick }) {
  return (
    <div className="stat-pill">
      <span className="stat-icon">{icon}</span>
      <div className="stat-text">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
      {onInfoClick && (
        <button type="button" className="info-badge" onClick={onInfoClick} aria-label={`What is ${label}?`}>
          i
        </button>
      )}
    </div>
  )
}
