import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { joinClass } from '../../../lib/storage'
import { getErrorMessage } from '../../../lib/errors'

// Mirrors Settings screen's own "Join a Class" form (still there, untouched)
// — this is a second entry point straight from My Classes, same endpoint.
// The two known codes already have good generic copy in errors.* (NOT_FOUND,
// ALREADY_JOINED), so this no longer needs its own messageFor() branching.

export default function JoinClassModal({ onJoined, onClose }) {
  const { t } = useTranslation()
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
      setError(getErrorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('teacher.joinClassTitle')}</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="join-class-code">{t('teacher.enterTeacherCode')}</label>
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
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('teacher.joining') : t('teacher.join')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
