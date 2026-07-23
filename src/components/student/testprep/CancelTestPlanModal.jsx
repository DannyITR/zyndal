import { useState } from 'react'

export default function CancelTestPlanModal({ onConfirm, onClose }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onConfirm()
    } catch {
      setError("Couldn't remove this plan. Please try again.")
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Remove this test prep plan?</h2>
        <p className="modal-subtitle">
          It won't count toward your streak or coins — this just clears it from your home screen. It stays in your
          Past Plans for reference.
        </p>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-block" disabled={saving} onClick={onClose}>
            Keep it
          </button>
          <button type="button" className="btn btn-primary btn-block" disabled={saving} onClick={handleConfirm}>
            {saving ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}
