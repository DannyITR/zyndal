import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { gradeWork } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'

// Scratchpad is Math-only — other subjects may be added in future.
// Shown below the Scratchpad after a correct Math answer — submits the
// drawn work for AI grading and awards the bonus XP/coin on approval. One
// resubmit is allowed after a rejection (enforced authoritatively by
// api/questions/grade-work.js; this just mirrors that in the UI).
const MAX_ATTEMPTS = 2

export default function WorkSubmissionPanel({ answerId, canvasRef, canvasHasDrawing, onApproved }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState('idle') // idle | loading | approved | rejected
  const [attempts, setAttempts] = useState(0)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (status === 'loading' || status === 'approved') return
    const dataUrl = canvasRef.current?.toDataURL()
    if (!dataUrl || canvasRef.current?.isEmpty()) return

    setStatus('loading')
    setError('')
    try {
      const result = await gradeWork(answerId, dataUrl)
      setAttempts((a) => a + 1)
      if (result.approved) {
        setStatus('approved')
        onApproved?.(result.xp_earned, result.coins_earned)
      } else {
        setStatus('rejected')
      }
    } catch (err) {
      // A remount after the bonus was already approved in an earlier
      // session (state resets on navigation) — treat as success rather
      // than surfacing a confusing "already earned" error.
      if (err.code === 'ALREADY_APPROVED') {
        setStatus('approved')
        return
      }
      if (err.code === 'NO_ATTEMPTS_LEFT') {
        setStatus('rejected')
        setAttempts(MAX_ATTEMPTS)
        return
      }
      setStatus(attempts > 0 ? 'rejected' : 'idle')
      setError(getErrorMessage(err, t))
    }
  }

  const attemptsLeft = MAX_ATTEMPTS - attempts
  const canResubmit = status === 'rejected' && attemptsLeft > 0

  return (
    <div className="work-submission-panel">
      {status === 'approved' && (
        <p className="work-submission-status work-submission-status--approved">✅ Work approved! +1 XP earned!</p>
      )}

      {status === 'rejected' && (
        <p className="work-submission-status work-submission-status--rejected">
          ❌ Work doesn't match this question — try showing your steps more clearly
        </p>
      )}

      {error && <p className="form-error">{error}</p>}

      {(status === 'idle' || status === 'loading' || canResubmit) && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={status === 'loading' || !canvasHasDrawing}
          onClick={handleSubmit}
        >
          {status === 'loading' ? 'Checking your work…' : 'Submit work for +1 bonus XP 🪙'}
        </button>
      )}
    </div>
  )
}
