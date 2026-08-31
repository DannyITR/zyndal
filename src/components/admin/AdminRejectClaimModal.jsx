import { useState } from 'react'

export default function AdminRejectClaimModal({ onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    await onConfirm(reason.trim())
    setSubmitting(false)
  }

  return (
    <div className="admin-modal-overlay" onClick={onCancel}>
      <div className="admin-modal admin-modal-small" onClick={(e) => e.stopPropagation()}>
        <h2>Reject Claim</h2>
        <p>The teacher will be notified. You can optionally add a reason.</p>
        <label className="admin-field">
          <span>Rejection reason (optional)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus />
        </label>
        <div className="admin-modal-actions">
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="admin-btn admin-btn-danger" disabled={submitting} onClick={handleConfirm}>
            {submitting ? 'Rejecting…' : 'Reject Claim'}
          </button>
        </div>
      </div>
    </div>
  )
}
