import { useState } from 'react'
import { centsToDisplay } from '../../../lib/money'

export default function GradeRewardNotification({ bonus, onResolve }) {
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
      setError("Couldn't process the bonus. Please try again.")
      setProcessing(false)
    }
  }

  const customCents = Math.round(Number(customAmount) * 100)
  const subjectLabel = bonus.subject ? `${bonus.subject}${bonus.topic ? ` ${bonus.topic}` : ''} test` : 'test'

  return (
    <div className="perfect-week-card">
      <p className="perfect-week-emoji">🎓</p>
      <p className="perfect-week-text">
        <strong>@{bonus.studentUsername}</strong> got <strong>{bonus.gradeReceived}%</strong> on their {subjectLabel}!
        Pay <strong>${centsToDisplay(bonus.suggestedBonusCents)}</strong> bonus?
      </p>

      {!adjusting ? (
        <div className="perfect-week-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={processing}
            onClick={() => handleConfirm(bonus.suggestedBonusCents)}
          >
            {processing ? 'Processing…' : `Confirm $${centsToDisplay(bonus.suggestedBonusCents)}`}
          </button>
          <button type="button" className="btn btn-ghost" disabled={processing} onClick={() => setAdjusting(true)}>
            Adjust Amount
          </button>
        </div>
      ) : (
        <div className="perfect-week-adjust">
          <div className="field">
            <label htmlFor={`grade-bonus-adjust-${bonus.id}`}>Custom amount ($)</label>
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
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={processing || !(customCents > 0)}
              onClick={() => handleConfirm(customCents)}
            >
              {processing ? 'Processing…' : `Confirm $${centsToDisplay(customCents)}`}
            </button>
          </div>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
