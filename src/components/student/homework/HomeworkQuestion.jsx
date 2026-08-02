import Scratchpad from '../Scratchpad'

const LETTERS = ['A', 'B', 'C', 'D']

// Single-attempt version of PracticeQuestion.jsx — homework has no retry:
// a wrong first answer just shows the correct answer + explanation and
// locks, matching the spec ("wrong = show correct answer+explanation, no
// XP/coins for that question").
//
// Scratchpad is Math-only — other subjects may be added in future.
// isMath's scratchpad here has no per-question submit button (unlike the
// daily question's WorkSubmissionPanel) — the drawn image is only read via
// scratchpadRef when the whole assignment is submitted (see
// HomeworkSessionScreen's handleSubmit), since homework submits everything
// in one batch and the resulting bonus goes to the teacher for review, not
// an instant AI grade.
export default function HomeworkQuestion({ number, question, attempt, isLate, isMath, scratchpadRef, onAnswer }) {
  const answered = Boolean(attempt)
  const selectedIndex = attempt?.selectedIndex ?? null

  function handleSelect(index) {
    if (answered) return
    onAnswer(index, index === question.correct)
  }

  return (
    <div className="testprep-question">
      <p className="testprep-question-prompt">
        {number}. {question.question}
      </p>

      {isMath && (!answered || attempt.correct) && <Scratchpad ref={scratchpadRef} />}

      <div className="options">
        {question.options.map((option, i) => {
          const isCorrect = i === question.correct
          const isSelected = i === selectedIndex
          let stateClass = ''
          if (answered) {
            if (isCorrect) stateClass = 'option--correct'
            else if (isSelected) stateClass = 'option--wrong'
            else stateClass = 'option--muted'
          }
          return (
            <button key={i} type="button" className={`option ${stateClass}`} disabled={answered} onClick={() => handleSelect(i)}>
              <span className="option-letter">{LETTERS[i]}</span>
              <span className="option-text">{option}</span>
              {answered && isCorrect && <span className="option-icon">✓</span>}
              {answered && isSelected && !isCorrect && <span className="option-icon">✕</span>}
            </button>
          )
        })}
      </div>

      {answered && attempt.correct && (
        <p className="testprep-question-result testprep-question-result--correct">
          Correct! +1 XP{isLate ? '' : ' +1 coin'}
        </p>
      )}
      {answered && !attempt.correct && (
        <div className="testprep-question-explanation">
          <p className="testprep-question-result testprep-question-result--wrong">Incorrect — no XP or coins for this question.</p>
          <p className="testprep-explanation-text">{question.explanation}</p>
        </div>
      )}
    </div>
  )
}
