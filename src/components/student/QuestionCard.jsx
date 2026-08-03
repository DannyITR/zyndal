import { useTranslation } from 'react-i18next'
import { formatQuestionSubtitle } from '../../lib/questions'

const LETTERS = ['A', 'B', 'C', 'D']

export default function QuestionCard({ question, answered, locked, selectedIndex, celebrate, onSelect, onOpenCurriculumTopic, scratchpadSlot }) {
  const { t } = useTranslation()
  // Only generated-pool questions carry real curriculum unit/topic tags
  // (see resolveDailyQuestion in api/_lib/dailyQuestion.js) — a hardcoded-
  // bank fallback question's `topic` is just a plain label with no
  // matching curriculum outline section to deep-link to. The link still
  // shows for those, though: onOpenCurriculumTopic({unitNumber: undefined,
  // topicTitle: undefined}) just opens the general curriculum reference
  // with nothing auto-expanded (CurriculumOutlineScreen's own
  // initialUnitNumber/initialTopicTitle handling already no-ops on a falsy
  // value — the same thing the plain "📖 Curriculum" nav button does), so
  // there's no wrong-topic deep link to worry about — only whether the
  // caller gave us a way to open curriculum at all.
  const hasCurriculumTopic = Boolean(onOpenCurriculumTopic)

  return (
    <div className={`question-card ${celebrate ? 'question-card--celebrate' : ''}`}>
      <p className="question-meta">{formatQuestionSubtitle(question)}</p>
      <h2 className="question-prompt">{question.prompt}</h2>

      {hasCurriculumTopic && (
        <button
          type="button"
          className="curriculum-topic-link"
          onClick={() => onOpenCurriculumTopic({ unitNumber: question.unitNumber, topicTitle: question.topicTitle })}
        >
          {answered ? t('question.reviewTopic') : t('question.readTopic')}
        </button>
      )}

      {scratchpadSlot}

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
