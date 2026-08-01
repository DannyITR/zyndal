import { useState } from 'react'
import { joinClass } from '../../../lib/storage'

// Mirrors Settings screen's own "Join a Class" form (still there, untouched)
// — this is a second entry point straight from My Classes, same endpoint.
function messageFor(err) {
  if (err.code === 'NOT_FOUND') return 'Invalid code — check with your teacher and try again.'
  if (err.code === 'ALREADY_JOINED') return 'You are already in this class.'
  return err.message || "Couldn't join that class. Please try again."
}

export default function JoinClassModal({ onJoined, onClose }) {
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!code.trim()) return
    setSaving(true)
    try {
      const { class: joinedClass } = await joinClass(code.trim())
      onJoined(joinedClass)
      onClose()
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Join a Class</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="join-class-code">Enter teacher code</label>
            <input
              id="join-class-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              autoFocus
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Joining…' : 'Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
