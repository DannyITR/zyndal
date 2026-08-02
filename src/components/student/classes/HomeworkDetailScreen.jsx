import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getHomeworkSubmission } from '../../../lib/storage'
import { formatLongDate } from '../../../lib/streak'
import { getErrorMessage } from '../../../lib/errors'
import TopBar from '../../shared/TopBar'

function AssignmentAnswers({ assignmentId }) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  function load() {
    getHomeworkSubmission(assignmentId)
      .then(setDetail)
      .catch((err) => setError(getErrorMessage(err, t)))
  }

  if (!detail && !error) {
    return (
      <button type="button" className="btn btn-secondary btn-small" onClick={load}>
        View My Answers
      </button>
    )
  }

  if (error) return <p className="form-error">{error}</p>

  return (
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
  )
}

export default function HomeworkDetailScreen({ user, date, assignments, onBack, onLogout, onLogoClick, onStart }) {
  return (
    <div className="screen student-screen">
      <TopBar title={formatLongDate(date)} subtitle="Homework" username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      {assignments.length === 0 ? (
        <p className="field-hint">No homework assigned for this day.</p>
      ) : (
        <div className="homework-question-list">
          {assignments.map((a) => (
            <div key={a.id} className="finance-section-card">
              <h3 className="section-heading">{a.title}</h3>
              <p className="teacher-class-detail">
                {a.subject} · {a.questionCount} question{a.questionCount === 1 ? '' : 's'}
              </p>

              {a.completed ? (
                <>
                  <p className="practice-results-score">{a.scorePercentage}% correct</p>
                  <p className="field-hint">Completed {formatLongDate(a.completedAt.slice(0, 10))}</p>
                  <AssignmentAnswers assignmentId={a.id} />
                </>
              ) : a.overdue ? (
                <button type="button" className="btn btn-primary btn-block" onClick={() => onStart(a.id)}>
                  Complete now (earns XP only)
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-block" onClick={() => onStart(a.id)}>
                  Start Homework
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
