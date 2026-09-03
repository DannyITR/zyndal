import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateForumReply } from '../../../lib/storage'
import { getErrorMessage } from '../../../lib/errors'
import { containsProfanity } from '../../../lib/profanityFilter'

export default function EditReplyModal({ reply, onClose, onSaved }) {
  const { t } = useTranslation()
  const [body, setBody] = useState(reply.body)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (containsProfanity(body)) {
      setError(t('forum.profanityWarning'))
      return
    }

    setSaving(true)
    try {
      await updateForumReply({ reply_id: reply.id, body: body.trim() })
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
        <h2 className="modal-title">{t('forum.editReplyTitle')}</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="forum-edit-reply-body">{t('forum.threadBodyLabel')}</label>
            <textarea id="forum-edit-reply-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={5000} required />
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
