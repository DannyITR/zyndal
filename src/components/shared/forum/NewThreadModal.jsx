import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createForumThread } from '../../../lib/storage'
import { getErrorMessage } from '../../../lib/errors'
import { containsProfanity } from '../../../lib/profanityFilter'

// Runs the exact same containsProfanity() check the server authoritatively
// re-runs (api/forum/create-thread.js) before ever calling the API — a fast
// client-side fail so a flagged post never makes a round trip, but the
// server check is what actually matters; this is only a UX nicety.
export default function NewThreadModal({ classType, classId, onClose, onCreated }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
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
      await createForumThread({ class_type: classType, class_id: classId, title: title.trim(), body: body.trim() })
      onCreated()
    } catch (err) {
      // errors.PROFANITY_DETECTED already matches forum.profanityWarning's
      // wording exactly (see translation.json) — getErrorMessage resolves it
      // on its own, no special-casing needed here.
      setError(getErrorMessage(err, t, 'forum.postFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('forum.newThreadTitle')}</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="forum-thread-title">{t('forum.threadTitleLabel')}</label>
            <input id="forum-thread-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required />
          </div>
          <div className="field">
            <label htmlFor="forum-thread-body">{t('forum.threadBodyLabel')}</label>
            <textarea id="forum-thread-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={5000} required />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('forum.posting') : t('forum.postButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
