import { useEffect, useState } from 'react'
import { getSubmissionDetail, reviewWork } from '../../lib/storage'

// Scratchpad is Math-only — other subjects may be added in future.
export default function SubmissionDetailModal({ assignmentId, studentId, username, onClose }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [reviewingId, setReviewingId] = useState(null)

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

  async function handleReview(workSubmissionId, approved) {
    if (reviewingId) return
    setReviewingId(workSubmissionId)
    try {
      await reviewWork(workSubmissionId, approved)
      setDetail((prev) => ({
        ...prev,
        workSubmissions: prev.workSubmissions.map((w) => (w.id === workSubmissionId ? { ...w, approved } : w)),
      }))
    } catch (err) {
      setError(err.message || "Couldn't submit your review. Please try again.")
    } finally {
      setReviewingId(null)
    }
  }

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
              const work = detail.workSubmissions?.find((w) => w.questionIndex === i)
              return (
                <div key={i} className="answer-review-row">
                  <p className="answer-review-question">
                    <strong>Q{i + 1}.</strong> {q.question}
                  </p>
                  <p className={correct ? 'answer-review-correct' : 'answer-review-wrong'}>
                    Answered: {selectedIndex != null ? q.options[selectedIndex] : '—'}
                  </p>
                  {!correct && <p className="answer-review-correct">Correct: {q.options[q.correct]}</p>}

                  {work && (
                    <div className="work-submission-panel">
                      <img src={`data:image/png;base64,${work.imageBase64}`} alt="Student's handwritten work" className="scratchpad-review-image" />
                      {work.approved === null ? (
                        <div className="modal-actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-small"
                            disabled={reviewingId === work.id}
                            onClick={() => handleReview(work.id, true)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            disabled={reviewingId === work.id}
                            onClick={() => handleReview(work.id, false)}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <p className={work.approved ? 'work-submission-status work-submission-status--approved' : 'work-submission-status work-submission-status--rejected'}>
                          {work.approved ? '✅ Approved — +1 XP awarded' : '❌ Rejected'}
                        </p>
                      )}
                    </div>
                  )}
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
