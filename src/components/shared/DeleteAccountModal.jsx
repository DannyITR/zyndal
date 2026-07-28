import { useState } from 'react'

// Requires typing the literal word "DELETE" (case-sensitive) before the
// confirm button enables — a higher bar than a plain confirm click, on
// purpose, since this schedules the account for permanent deletion.
export default function DeleteAccountModal({ onConfirm, onClose }) {
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const canConfirm = confirmText === 'DELETE' && !deleting

  async function handleConfirm() {
    if (!canConfirm) return
    setDeleting(true)
    setError('')
    try {
      await onConfirm()
    } catch (err) {
      setError(err.message || "Couldn't delete your account. Please try again.")
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Delete My Account</h2>
        <p className="modal-subtitle">
          This will deactivate your account and schedule all your data for permanent deletion in
          90 days. You can restore your account within 90 days by emailing{' '}
          <a href="mailto:hello@zyndal.com">hello@zyndal.com</a>.
        </p>

        <div className="field">
          <label htmlFor="delete-confirm-input">
            Type <strong>DELETE</strong> to confirm
          </label>
          <input
            id="delete-confirm-input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            disabled={deleting}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-block" disabled={deleting} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger btn-block" disabled={!canConfirm} onClick={handleConfirm}>
            {deleting ? 'Deleting…' : 'Delete My Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
