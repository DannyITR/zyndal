import { useState } from 'react'

const LETTERS = ['A', 'B', 'C', 'D']
const SOURCE_LABEL = { upload: 'From your uploads', bank: 'Study Guide' }

// One practice question. Unlike the test-prep question component, this one
// awards coins on a correct first attempt (never XP) and shows where the
// question came from. Retries after a wrong first attempt are local-only
// and never rewarded.
export default function PracticeQuestion({ number, question, firstAttempt, onFirstAttempt }) {
  const [retryAttempt, setRetryAttempt] = useState(null)
  const [saving, setSaving] = useState(false)

  const firstAttemptMade = Boolean(firstAttempt)
  const firstAttemptWrong = firstAttemptMade && !firstAttempt.correct
  const solvedByRetry = Boolean(retryAttempt?.correct)
  const canRetry = firstAttemptWrong && !solvedByRetry
  const locked = firstAttemptMade && (firstAttempt.correct || solvedByRetry)

  const activeAttempt = retryAttempt ?? firstAttempt
  const displaySelectedIndex = activeAttempt?.selectedIndex ?? null
  const answered = displaySelectedIndex !== null

  async function handleSelect(index) {
    if (saving) return
    if (firstAttemptMade) {
      if (!canRetry) return
      setRetryAttempt({ selectedIndex: index, correct: index === question.correct })
      return
    }
    setSaving(true)
    try {
      await onFirstAttempt(index, index === question.correct)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="testprep-question">
      <div className="practice-question-header">
        <p className="testprep-question-prompt">
          {number}. {question.question}
        </p>
        <span className="practice-source-badge">{SOURCE_LABEL[question.source]}</span>
      </div>

      <div className="options">
        {question.options.map((option, i) => {
          const isCorrect = i === question.correct
          const isSelected = i === displaySelectedIndex
          let stateClass = ''
          if (answered) {
            if (isCorrect) stateClass = 'option--correct'
            else if (isSelected) stateClass = 'option--wrong'
            else stateClass = 'option--muted'
          }
          return (
            <button
              key={i}
              type="button"
              className={`option ${stateClass}`}
              disabled={locked}
              onClick={() => handleSelect(i)}
            >
              <span className="option-letter">{LETTERS[i]}</span>
              <span className="option-text">{option}</span>
              {answered && isCorrect && <span className="option-icon">✓</span>}
              {answered && isSelected && !isCorrect && <span className="option-icon">✕</span>}
            </button>
          )
        })}
      </div>

      {firstAttemptMade && firstAttempt.correct && (
        <p className="testprep-question-result testprep-question-result--correct">Correct! +1 coin</p>
      )}
      {firstAttemptWrong && (
        <div className="testprep-question-explanation">
          <p className="testprep-question-result testprep-question-result--wrong">
            {solvedByRetry ? 'Nice — retries don’t earn coins, but now you know it.' : 'No coins earned — try again to learn the answer.'}
          </p>
          <p className="testprep-explanation-text">{question.explanation}</p>
        </div>
      )}
    </div>
  )
}
