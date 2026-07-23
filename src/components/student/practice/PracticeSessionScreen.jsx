import { useState } from 'react'
import { awardCoins, savePracticeSession } from '../../../lib/storage'
import TopBar from '../../shared/TopBar'
import PracticeQuestion from './PracticeQuestion'

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
  const [coinsEarned, setCoinsEarned] = useState(0)
  const [error, setError] = useState('')
  const [finishing, setFinishing] = useState(false)

  const allAnswered = Object.keys(answers).length === questions.length

  async function handleFirstAttempt(questionIndex, selectedIndex, correct) {
    setError('')
    try {
      if (correct) await awardCoins(user.id, 1)
      setAnswers((prev) => ({ ...prev, [questionIndex]: { selectedIndex, correct } }))
      if (correct) setCoinsEarned((c) => c + 1)
    } catch (err) {
      console.error('[Practice] coin award failed:', err)
      setError("Couldn't save your answer. Check your connection and try again.")
      throw err
    }
  }

  async function handleSeeResults() {
    setFinishing(true)
    const questionsCorrect = Object.values(answers).filter((a) => a.correct).length
    const questionsTotal = questions.length
    const scorePercentage = Math.round((questionsCorrect / questionsTotal) * 100)
    try {
      await savePracticeSession({
        userId: user.id,
        subject: subjectId,
        topic,
        scorePercentage,
        questionsCorrect,
        questionsTotal,
        coinsEarned,
      })
    } catch (err) {
      console.error('[Practice] session save failed:', err)
    }
    onFinished({ questionsCorrect, questionsTotal, coinsEarned, scorePercentage })
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
