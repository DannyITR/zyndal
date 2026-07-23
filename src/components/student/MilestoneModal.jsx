export default function MilestoneModal({ milestone, onClose }) {
  if (!milestone) return null
  const { streak, bonus } = milestone

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card milestone-card" onClick={(e) => e.stopPropagation()}>
        <div className="milestone-confetti" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="confetti-piece" style={{ '--i': i }} />
          ))}
        </div>
        <p className="milestone-emoji">🔥</p>
        <h2 className="milestone-title">{streak}-Day Streak!</h2>
        <p className="milestone-subtitle">You're on fire. Keep it going.</p>
        <p className="milestone-bonus">+{bonus} bonus XP &amp; +{bonus} bonus coins</p>
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          Let's go!
        </button>
      </div>
    </div>
  )
}
