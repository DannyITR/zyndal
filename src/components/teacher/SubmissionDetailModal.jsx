import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSubmissionDetail, reviewWork } from '../../lib/storage'

// Scratchpad is Math-only — other subjects may be added in future.
export default function SubmissionDetailModal({ assignmentId, studentId, username, onClose }) {
  const { t } = useTranslation()
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
        if (!cancelled) setError(err.message || t('teacher.loadAnswersFailed'))
      })
    return () => {
      cancelled = true
    }
    // t is a stable function for the app's lifetime (see src/lib/i18n.js) —
    // not a real dependency, and including it would refetch on every
    // language change for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError(err.message || t('teacher.submitReviewFailed'))
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('teacher.answersTitle', { username })}</h2>

        {error && <p className="form-error">{error}</p>}
        {!error && !detail && <p className="loading-text">{t('common.loading')}</p>}

        {detail && !detail.submitted && <p className="field-hint">{t('teacher.notSubmittedYet')}</p>}

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
                    {t('teacher.answeredLabel', { answer: selectedIndex != null ? q.options[selectedIndex] : '—' })}
                  </p>
                  {!correct && <p className="answer-review-correct">{t('teacher.correctLabel', { answer: q.options[q.correct] })}</p>}

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
                            {t('teacher.approve')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            disabled={reviewingId === work.id}
                            onClick={() => handleReview(work.id, false)}
                          >
                            {t('teacher.reject')}
                          </button>
                        </div>
                      ) : (
                        <p className={work.approved ? 'work-submission-status work-submission-status--approved' : 'work-submission-status work-submission-status--rejected'}>
                          {work.approved ? t('teacher.workApproved') : t('teacher.workRejected')}
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
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
