import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../../lib/errors'

// Generic report-reason modal — onSubmit(reason) is provided by the caller
// so this has no idea whether it's reporting a forum post or a private
// message; ForumScreen.jsx passes (reason) => reportForumContent({...}),
// MessagesFlow.jsx passes (reason) => reportMessage({...}). The wording
// ("Report content", "Why are you reporting this?", etc.) is generic enough
// to reuse as-is for either content type, so no new i18n keys needed here.
export default function ReportContentModal({ onSubmit, onClose, onReported }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving || !reason.trim()) return
    setError('')
    setSaving(true)
    try {
      await onSubmit(reason.trim())
      setSubmitted(true)
    } catch (err) {
      setError(getErrorMessage(err, t, 'forum.reportFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('forum.reportTitle')}</h2>
        {submitted ? (
          <>
            <p className="field-hint">{t('forum.reportSubmitted')}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={onReported}>
                {t('common.done')}
              </button>
            </div>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="forum-report-reason">{t('forum.reportReasonLabel')}</label>
              <textarea id="forum-report-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} required />
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? t('forum.posting') : t('forum.reportSubmit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
