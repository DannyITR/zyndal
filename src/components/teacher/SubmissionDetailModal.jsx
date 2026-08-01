import { useEffect, useState } from 'react'
import { getSubmissionDetail } from '../../lib/storage'

export default function SubmissionDetailModal({ assignmentId, studentId, username, onClose }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getSubmissionDetail(assignmentId, studentId)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Couldn't load this student's answers.")
      })
    return () => {
      cancelled = true
    }
  }, [assignmentId, studentId])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">@{username}'s Answers</h2>

        {error && <p className="form-error">{error}</p>}
        {!error && !detail && <p className="loading-text">Loading…</p>}

        {detail && !detail.submitted && <p className="field-hint">Not submitted yet.</p>}

        {detail && detail.submitted && (
          <div className="answer-review-list">
            {detail.questions.map((q, i) => {
              const selectedIndex = detail.answers?.[i]?.selectedIndex
              const correct = detail.answers?.[i]?.correct
              return (
                <div key={i} className="answer-review-row">
                  <p className="answer-review-question">
                    <strong>Q{i + 1}.</strong> {q.question}
                  </p>
                  <p className={correct ? 'answer-review-correct' : 'answer-review-wrong'}>
                    Answered: {selectedIndex != null ? q.options[selectedIndex] : '—'}
                  </p>
                  {!correct && <p className="answer-review-correct">Correct: {q.options[q.correct]}</p>}
                </div>
              )
            })}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
