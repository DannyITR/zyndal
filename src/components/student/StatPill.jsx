export default function StatPill({ icon, label, value }) {
  return (
    <div className="stat-pill">
      <span className="stat-icon">{icon}</span>
      <div className="stat-text">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  )
}
