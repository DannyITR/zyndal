import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../../lib/errors'

// Shared by both "delete my thread" and "delete my reply" — the only
// difference is which title/warning key the caller passes in. Lower
// friction than DeleteAccountModal's typed-"DELETE" gate (matches
// LeaveClassModal's own reasoning): this only hides the post from the
// normal view, it never actually removes the row (see
// api/forum/delete-thread.js / delete-reply.js).
export default function ConfirmDeleteContentModal({ titleKey, warningKey, onConfirm, onClose }) {
  const { t } = useTranslation()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    if (deleting) return
    setDeleting(true)
    setError('')
    try {
      await onConfirm()
    } catch (err) {
      setError(getErrorMessage(err, t, 'forum.deleteFailed'))
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t(titleKey)}</h2>
        <p className="modal-subtitle">{t(warningKey)}</p>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-block" disabled={deleting} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-danger btn-block" disabled={deleting} onClick={handleConfirm}>
            {deleting ? t('forum.deleting') : t('forum.deleteConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
