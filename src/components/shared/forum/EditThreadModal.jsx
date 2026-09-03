import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateForumThread } from '../../../lib/storage'
import { getErrorMessage } from '../../../lib/errors'
import { containsProfanity } from '../../../lib/profanityFilter'

// Mirrors NewThreadModal.jsx exactly (same client-side profanity fast-fail,
// same server re-check) but pre-filled and calling update-thread instead of
// create-thread — api/forum/update-thread.js re-verifies the caller is the
// thread's own author regardless of what this form sends.
export default function EditThreadModal({ thread, onClose, onSaved }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(thread.title)
  const [body, setBody] = useState(thread.body)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (containsProfanity(title) || containsProfanity(body)) {
      setError(t('forum.profanityWarning'))
      return
    }

    setSaving(true)
    try {
      await updateForumThread({ thread_id: thread.id, title: title.trim(), body: body.trim() })
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, t, 'forum.editFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('forum.editThreadTitle')}</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="forum-edit-thread-title">{t('forum.threadTitleLabel')}</label>
            <input id="forum-edit-thread-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required />
          </div>
          <div className="field">
            <label htmlFor="forum-edit-thread-body">{t('forum.threadBodyLabel')}</label>
            <textarea id="forum-edit-thread-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={5000} required />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('forum.saving') : t('forum.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
