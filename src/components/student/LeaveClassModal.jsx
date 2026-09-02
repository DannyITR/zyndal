import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'

// Lower-friction than DeleteAccountModal's typed "DELETE" confirmation —
// leaving a class is reversible (rejoin the group anytime, or rejoin a
// claimed class with its code again), not permanent data loss.
export default function LeaveClassModal({ classLabel, onConfirm, onClose }) {
  const { t } = useTranslation()
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    if (leaving) return
    setLeaving(true)
    setError('')
    try {
      await onConfirm()
    } catch (err) {
      setError(getErrorMessage(err, t, 'classCard.leaveFailed'))
      setLeaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('classCard.leaveTitle')}</h2>
        <p className="modal-subtitle">{t('classCard.leaveWarning', { class: classLabel })}</p>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-block" disabled={leaving} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-danger btn-block" disabled={leaving} onClick={handleConfirm}>
            {leaving ? t('classCard.leaving') : t('classCard.leaveConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
