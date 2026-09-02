import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { reportForumContent } from '../../../lib/storage'
import { getErrorMessage } from '../../../lib/errors'

export default function ReportContentModal({ targetType, targetId, onClose, onReported }) {
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
      await reportForumContent({ target_type: targetType, target_id: targetId, reason: reason.trim() })
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
