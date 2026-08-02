import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'

// Requires typing the literal word "DELETE" (case-sensitive) before the
// confirm button enables — a higher bar than a plain confirm click, on
// purpose, since this schedules the account for permanent deletion. The
// word itself stays untranslated in every language (the placeholder and
// the confirmText === 'DELETE' check both use the literal English word) —
// translating it would mean also changing that comparison, which isn't
// worth it for a single confirmation token.
export default function DeleteAccountModal({ onConfirm, onClose }) {
  const { t } = useTranslation()
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const canConfirm = confirmText === 'DELETE' && !deleting

  async function handleConfirm() {
    if (!canConfirm) return
    setDeleting(true)
    setError('')
    try {
      await onConfirm()
    } catch (err) {
      setError(getErrorMessage(err, t, 'deleteAccount.deleteFailed'))
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('deleteAccount.title')}</h2>
        <p className="modal-subtitle">
          {t('deleteAccount.warningPrefix')}{' '}
          <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>.
        </p>

        <div className="field">
          <label htmlFor="delete-confirm-input">
            {t('deleteAccount.confirmPrefix')} <strong>DELETE</strong> {t('deleteAccount.confirmSuffix')}
          </label>
          <input
            id="delete-confirm-input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            disabled={deleting}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-block" disabled={deleting} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-danger btn-block" disabled={!canConfirm} onClick={handleConfirm}>
            {deleting ? t('deleteAccount.deleting') : t('deleteAccount.title')}
          </button>
        </div>
      </div>
    </div>
  )
}
