import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getErrorMessage } from '../../lib/errors'

// Lower-friction than DeleteAccountModal's typed "DELETE" confirmation —
// leaving a class is reversible (rejoin the group anytime, or rejoin a
// claimed class with its code again), not permanent data loss.
//
// copy: optional wording overrides ({ title, warning, confirm, busy,
// failKey }) for the same confirm-and-leave flow with different words —
// removing a course added from another grade (ClassCard.jsx) uses it.
export default function LeaveClassModal({ classLabel, copy, onConfirm, onClose }) {
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
      setError(getErrorMessage(err, t, copy?.failKey || 'classCard.leaveFailed'))
      setLeaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{copy?.title || t('classCard.leaveTitle')}</h2>
        <p className="modal-subtitle">{copy?.warning || t('classCard.leaveWarning', { class: classLabel })}</p>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-block" disabled={leaving} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-danger btn-block" disabled={leaving} onClick={handleConfirm}>
            {leaving ? copy?.busy || t('classCard.leaving') : copy?.confirm || t('classCard.leaveConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
