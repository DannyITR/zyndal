import { useState } from 'react'
import { savePracticeSession } from '../../../lib/storage'
import TopBar from '../../shared/TopBar'
import PracticeQuestion from './PracticeQuestion'

// Session 5: coins are no longer awarded live per question — see
// api/student/save-practice-session.js's header comment for why an
// authoritative per-question award isn't possible for AI/upload-sourced
// practice content. `answers` still drives the running coinsEarned shown
// while the session is in progress (cosmetic only, not a DB write); the
// real award happens once, when the session is saved.
export default function PracticeSessionScreen({
  user,
  subjectId,
  subjectName,
  topic,
  questions,
  onFinished,
  onBack,
  onLogout,
  onLogoClick,
}) {
  const [answers, setAnswers] = useState({}) // questionIndex -> { selectedIndex, correct }
  const [error, setError] = useState('')
  const [finishing, setFinishing] = useState(false)

  const allAnswered = Object.keys(answers).length === questions.length
  const coinsEarned = Object.values(answers).filter((a) => a.correct).length

  function handleFirstAttempt(questionIndex, selectedIndex, correct) {
    setError('')
    setAnswers((prev) => ({ ...prev, [questionIndex]: { selectedIndex, correct } }))
  }

  async function handleSeeResults() {
    setFinishing(true)
    const questionsCorrect = coinsEarned
    const questionsTotal = questions.length
    try {
      const session = await savePracticeSession({
        userId: user.id,
        subject: subjectId,
        topic,
        questionsCorrect,
        questionsTotal,
      })
      onFinished({
        questionsCorrect: session.questions_correct,
        questionsTotal: session.questions_total,
        coinsEarned: session.coins_earned,
        scorePercentage: session.score_percentage,
      })
    } catch (err) {
      console.error('[Practice] session save failed:', err)
      setError("Couldn't save your results. Check your connection and try again.")
      setFinishing(false)
    }
  }

  return (
    <div className="screen student-screen">
      <TopBar
        title="📘 Practice"
        subtitle={`${subjectName} — ${topic}`}
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
        subscriptionStatus={user.subscription_status}
        daysRemainingInTrial={user.days_remaining_in_trial}
      />

      {error && <p className="form-error">{error}</p>}

      {questions.map((question, i) => (
        <PracticeQuestion
          key={i}
          number={i + 1}
          question={question}
          firstAttempt={answers[i]}
          onFirstAttempt={(selectedIndex, correct) => handleFirstAttempt(i, selectedIndex, correct)}
        />
      ))}

      {allAnswered && (
        <button type="button" className="btn btn-primary btn-block" disabled={finishing} onClick={handleSeeResults}>
          {finishing ? 'Saving…' : 'See My Results'}
        </button>
      )}
    </div>
  )
}
