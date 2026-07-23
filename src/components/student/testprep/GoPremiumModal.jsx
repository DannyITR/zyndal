export default function GoPremiumModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card premium-modal" onClick={(e) => e.stopPropagation()}>
        <p className="premium-modal-emoji">✨</p>
        <h2 className="modal-title">Go Premium</h2>
        <p className="premium-modal-price">
          $9.99<span className="premium-modal-price-period">/month</span>
        </p>

        <ul className="premium-benefits">
          <li>📝 AI-powered test prep — tell us when your test is and get a day-by-day study plan</li>
          <li>📚 Daily study guide with fresh practice questions for your grade</li>
          <li>🎯 Readiness score so you know when you're prepared</li>
        </ul>

        <button type="button" className="btn btn-primary btn-block" disabled>
          Subscribe — coming soon
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  )
}
