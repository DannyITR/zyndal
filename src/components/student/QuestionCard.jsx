const LETTERS = ['A', 'B', 'C', 'D']

export default function QuestionCard({ question, answered, locked, selectedIndex, celebrate, onSelect }) {
  return (
    <div className={`question-card ${celebrate ? 'question-card--celebrate' : ''}`}>
      <p className="question-meta">
        Grade {question.grade} • {question.topic}
      </p>
      <h2 className="question-prompt">{question.prompt}</h2>
      <div className="options">
        {question.options.map((option, i) => {
          const isCorrect = i === question.correctIndex
          const isSelected = i === selectedIndex
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
              onClick={() => onSelect(i)}
            >
              <span className="option-letter">{LETTERS[i]}</span>
              <span className="option-text">{option}</span>
              {answered && isCorrect && <span className="option-icon">✓</span>}
              {answered && isSelected && !isCorrect && <span className="option-icon">✕</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
