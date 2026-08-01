import { useState } from 'react'

export default function AdminConfirmDeleteModal({ username, hardDelete, onCancel, onConfirm }) {
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    if (confirmText !== 'DELETE' || submitting) return
    setSubmitting(true)
    await onConfirm()
    setSubmitting(false)
  }

  return (
    <div className="admin-modal-overlay" onClick={onCancel}>
      <div className="admin-modal admin-modal-small" onClick={(e) => e.stopPropagation()}>
        <h2>{hardDelete ? 'Permanently Delete Account' : 'Soft Delete Account'}</h2>
        <p>
          {hardDelete ? (
            <>
              This will <strong>permanently and irreversibly</strong> delete @{username} and every row of their data. This cannot be
              undone.
            </>
          ) : (
            <>
              This will deactivate @{username}&rsquo;s account. It can be restored later from this panel.
            </>
          )}
        </p>
        <label className="admin-field">
          <span>
            Type <strong>DELETE</strong> to confirm
          </span>
          <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
        </label>
        <div className="admin-modal-actions">
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            disabled={confirmText !== 'DELETE' || submitting}
            onClick={handleConfirm}
          >
            {submitting ? 'Deleting…' : hardDelete ? 'Permanently Delete' : 'Soft Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
