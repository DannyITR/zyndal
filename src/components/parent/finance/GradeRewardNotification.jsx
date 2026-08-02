import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { centsToDisplay } from '../../../lib/money'

export default function GradeRewardNotification({ bonus, onResolve }) {
  const { t } = useTranslation()
  const [adjusting, setAdjusting] = useState(false)
  const [customAmount, setCustomAmount] = useState(centsToDisplay(bonus.suggestedBonusCents))
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm(amountCents) {
    if (!(amountCents > 0) || processing) return
    setProcessing(true)
    setError('')
    try {
      await onResolve(amountCents)
    } catch {
      setError(t('finance.bonusFailed'))
      setProcessing(false)
    }
  }

  const customCents = Math.round(Number(customAmount) * 100)
  const subjectLabel = bonus.subject
    ? `${t(`subjects.${bonus.subject}`, { defaultValue: bonus.subject })}${bonus.topic ? ` ${bonus.topic}` : ''} ${t('finance.testWord')}`
    : t('finance.testWord')

  return (
    <div className="perfect-week-card">
      <p className="perfect-week-emoji">🎓</p>
      <p className="perfect-week-text">
        {t('finance.gradeBonusText', {
          username: bonus.studentUsername,
          grade: bonus.gradeReceived,
          subject: subjectLabel,
          amount: centsToDisplay(bonus.suggestedBonusCents),
        })}
      </p>

      {!adjusting ? (
        <div className="perfect-week-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={processing}
            onClick={() => handleConfirm(bonus.suggestedBonusCents)}
          >
            {processing ? t('finance.processing') : t('finance.confirmAmount', { amount: centsToDisplay(bonus.suggestedBonusCents) })}
          </button>
          <button type="button" className="btn btn-ghost" disabled={processing} onClick={() => setAdjusting(true)}>
            {t('finance.adjustAmount')}
          </button>
        </div>
      ) : (
        <div className="perfect-week-adjust">
          <div className="field">
            <label htmlFor={`grade-bonus-adjust-${bonus.id}`}>{t('finance.customAmount')}</label>
            <input
              id={`grade-bonus-adjust-${bonus.id}`}
              type="number"
              min="0"
              step="0.01"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="perfect-week-actions">
            <button type="button" className="btn btn-ghost" disabled={processing} onClick={() => setAdjusting(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={processing || !(customCents > 0)}
              onClick={() => handleConfirm(customCents)}
            >
              {processing ? t('finance.processing') : t('finance.confirmAmount', { amount: centsToDisplay(customCents) })}
            </button>
          </div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
