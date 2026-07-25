export default function InfoModal({ icon, title, text, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card info-modal" onClick={(e) => e.stopPropagation()}>
        <p className="info-modal-icon">{icon}</p>
        <h2 className="modal-title">{title}</h2>
        <p className="info-modal-text">{text}</p>
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  )
}
