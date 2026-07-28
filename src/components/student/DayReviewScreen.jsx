import { useState } from 'react'
import { submitLateAnswer } from '../../lib/storage'
import { getDailyQuestion, SUBJECTS } from '../../lib/questions'
import TopBar from '../shared/TopBar'
import QuestionCard from './QuestionCard'

// Opened by tapping a past day in CalendarScreen.jsx. Shows what happened
// that day per subject (read-only — no re-answering an already-answered
// subject), and lets the student catch up on any subject they missed via
// api/student/submit-late-answer.js (XP only, no coins/streak — see that
// file's header comment).
export default function DayReviewScreen({ user, date, progress, onAnswered, onBack, onLogout, onLogoClick }) {
  const [answeringSubjectId, setAnsweringSubjectId] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // Entries just answered this session, keyed by subject — progress itself
  // only updates via the onAnswered callback bubbling up to StudentFlow.jsx
  // and back down as a new prop, so this covers the render in between.
  const [justAnswered, setJustAnswered] = useState({})

  function entryFor(subjectId) {
    return justAnswered[subjectId] ?? progress.history.find((h) => h.date === date && h.subjectId === subjectId) ?? null
  }

  function startAnswering(subjectId) {
    setAnsweringSubjectId(subjectId)
    setSelectedIndex(null)
    setSubmitError('')
  }

  async function handleSelect(subjectId, index) {
    if (submitting) return
    setSelectedIndex(index)
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await submitLateAnswer({ subject: subjectId, selectedIndex: index, date })
      setJustAnswered((prev) => ({ ...prev, [subjectId]: result.entry }))
      setAnsweringSubjectId(null)
      onAnswered(result.entry)
    } catch (err) {
      setSubmitError(err.message || "Couldn't save your answer. Please try again.")
      setSelectedIndex(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="screen student-screen">
      <TopBar title={`📅 ${date}`} subtitle="Day review" username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      <div className="day-review-list">
        {SUBJECTS.map((subject) => {
          const entry = entryFor(subject.id)
          const isAnswering = answeringSubjectId === subject.id

          return (
            <div key={subject.id} className="day-review-subject">
              <div className="day-review-subject-header">
                <span className="day-review-subject-icon">{subject.icon}</span>
                <span className="day-review-subject-name">{subject.name}</span>
                {entry && (
                  <span
                    className={`day-review-subject-badge ${
                      entry.correct ? 'day-review-subject-badge--correct' : 'day-review-subject-badge--wrong'
                    }`}
                  >
                    {entry.correct ? '✓ Correct' : '✗ Incorrect'}
                  </span>
                )}
              </div>

              {entry && (
                <div className="answer-summary">
                  <p className="question-prompt">{entry.prompt}</p>
                  <div className="answer-summary-row">
                    <span className="answer-summary-label">Their answer</span>
                    <span
                      className={`answer-summary-value ${
                        entry.correct ? 'answer-summary-value--correct' : 'answer-summary-value--wrong'
                      }`}
                    >
                      {entry.selectedAnswer}
                    </span>
                  </div>
                  {!entry.correct && (
                    <div className="answer-summary-row">
                      <span className="answer-summary-label">Correct answer</span>
                      <span className="answer-summary-value answer-summary-value--correct">{entry.correctAnswer}</span>
                    </div>
                  )}
                </div>
              )}

              {!entry && !isAnswering && (
                <button type="button" className="btn btn-secondary btn-small" onClick={() => startAnswering(subject.id)}>
                  Answer now
                </button>
              )}

              {!entry && isAnswering && (
                <div className="day-review-answer-now">
                  <p className="late-answer-notice">Late answer — earns XP only, does not count toward streak.</p>
                  <QuestionCard
                    question={getDailyQuestion(subject.id, new Date(`${date}T12:00:00Z`))}
                    answered={selectedIndex !== null}
                    locked={submitting || selectedIndex !== null}
                    selectedIndex={selectedIndex}
                    celebrate={false}
                    onSelect={(index) => handleSelect(subject.id, index)}
                  />
                  {submitError && <p className="form-error">{submitError}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
