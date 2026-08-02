import { useRef, useState } from 'react'
import { submitHomework } from '../../../lib/storage'
import { todayStr, formatLongDate } from '../../../lib/streak'
import { getUserTimeZone } from '../../../lib/timezone'
import TopBar from '../../shared/TopBar'
import HomeworkQuestion from './HomeworkQuestion'

// Scratchpad is Math-only — other subjects may be added in future.
export default function HomeworkSessionScreen({ user, assignment, onFinished, onBack, onLogout, onLogoClick }) {
  const [answers, setAnswers] = useState({}) // questionIndex -> { selectedIndex, correct }
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isMath = assignment.subject === 'math'
  const scratchpadRefs = useRef([])

  const today = todayStr(new Date(), getUserTimeZone())
  const isLate = assignment.dueDate < today
  const questions = assignment.questions
  const allAnswered = Object.keys(answers).length === questions.length

  function handleAnswer(index, selectedIndex, correct) {
    setError('')
    setAnswers((prev) => ({ ...prev, [index]: { selectedIndex, correct } }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    try {
      const selectedIndexes = questions.map((_, i) => answers[i].selectedIndex)
      const workImages = {}
      if (isMath) {
        scratchpadRefs.current.forEach((pad, i) => {
          if (pad && !pad.isEmpty()) workImages[i] = pad.toDataURL()
        })
      }
      const result = await submitHomework(assignment.id, selectedIndexes, workImages)
      onFinished(result)
    } catch (err) {
      console.error('[Homework] submit failed:', err)
      setError(err.message || "Couldn't submit your homework. Please try again.")
      setSubmitting(false)
    }
  }

  return (
    <div className="screen student-screen">
      <TopBar
        title={`📚 ${assignment.title}`}
        subtitle={`${assignment.subject} · Due ${formatLongDate(assignment.dueDate)}`}
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      {isLate && <p className="field-hint">This assignment is past due — you'll still earn XP, but no coins.</p>}
      {error && <p className="form-error">{error}</p>}

      {questions.map((question, i) => (
        <HomeworkQuestion
          key={i}
          number={i + 1}
          question={question}
          attempt={answers[i]}
          isLate={isLate}
          isMath={isMath}
          scratchpadRef={(el) => (scratchpadRefs.current[i] = el)}
          onAnswer={(selectedIndex, correct) => handleAnswer(i, selectedIndex, correct)}
        />
      ))}

      {allAnswered && (
        <button type="button" className="btn btn-primary btn-block" disabled={submitting} onClick={handleSubmit}>
          {submitting ? 'Submitting…' : 'Submit Homework'}
        </button>
      )}
    </div>
  )
}
