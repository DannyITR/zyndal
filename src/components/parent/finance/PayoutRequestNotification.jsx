import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { centsToDisplay } from '../../../lib/money'

export default function PayoutRequestNotification({ request, onApprove, onDecline }) {
  const { t } = useTranslation()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function handle(action) {
    if (processing) return
    setProcessing(true)
    setError('')
    try {
      await action()
    } catch {
      setError(t('finance.payoutRequestFailed'))
      setProcessing(false)
    }
  }

  return (
    <div className="perfect-week-card">
      <p className="perfect-week-emoji">💰</p>
      <p className="perfect-week-text">
        {t('finance.payoutRequestText', { username: request.studentUsername, amount: centsToDisplay(request.dollarAmountCents) })}
      </p>
      {request.note && <p className="field-hint">{t('finance.payoutRequestNote', { note: request.note })}</p>}
      <div className="perfect-week-actions">
        <button type="button" className="btn btn-primary" disabled={processing} onClick={() => handle(onApprove)}>
          {processing ? t('finance.processing') : t('finance.approveAmount', { amount: centsToDisplay(request.dollarAmountCents) })}
        </button>
        <button type="button" className="btn btn-ghost" disabled={processing} onClick={() => handle(onDecline)}>
          {t('common.decline')}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
