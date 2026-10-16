import { useTranslation } from 'react-i18next'

const LETTERS = ['A', 'B', 'C', 'D']

// The Study Guide's practice run over questions from the student's own
// uploads (see api/study-guide-questions.js): one 4-option question at a
// time, right/wrong shown as soon as an option is picked with the correct
// one highlighted, then Next. Ends on the score with "Retry missed" (a new
// run over just the wrong ones) or "Start over" (the same set again). Like
// the rest of the Study Guide, nothing here awards coins or XP.
//
// session: { questions, index, answers } — answers[i] is { selectedIndex,
// correct } once question i is answered. Owned by StudyGuideScreen, which
// caches it so a reload resumes; onChange hands back each update.
export default function StudyGuidePractice({ session, onChange }) {
  const { t } = useTranslation()
  const { questions, index, answers } = session
  const finished = index >= questions.length

  if (finished) {
    const correctCount = answers.filter((a) => a?.correct).length
    const missed = questions.filter((_, i) => !answers[i]?.correct)
    const percent = questions.length ? Math.round((correctCount / questions.length) * 100) : 0
    return (
      <div className="study-guide-score">
        <p className="study-guide-score-title">{t('studyGuide.scoreTitle')}</p>
        <p className="study-guide-score-value">{t('studyGuide.score', { correct: correctCount, total: questions.length, percent })}</p>
        {missed.length === 0 && <p className="field-hint">{t('studyGuide.perfect')}</p>}
        {missed.length > 0 && (
          <button type="button" className="btn btn-primary btn-block" onClick={() => onChange({ questions: missed, index: 0, answers: [] })}>
            {t('studyGuide.retryMissed', { count: missed.length })}
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-block" onClick={() => onChange({ questions, index: 0, answers: [] })}>
          {t('studyGuide.startOver')}
        </button>
      </div>
    )
  }

  const question = questions[index]
  const answer = answers[index]
  const answered = Boolean(answer)

  function handleSelect(optionIndex) {
    if (answered) return
    const next = [...answers]
    next[index] = { selectedIndex: optionIndex, correct: optionIndex === question.correct }
    onChange({ ...session, answers: next })
  }

  function handleNext() {
    onChange({ ...session, index: index + 1 })
  }

  return (
    <div className="testprep-question">
      <p className="study-guide-progress">{t('studyGuide.questionOf', { current: index + 1, total: questions.length })}</p>
      <p className="testprep-question-prompt">{question.question}</p>
      <div className="options">
        {question.options.map((option, i) => {
          const isCorrect = i === question.correct
          const isSelected = i === answer?.selectedIndex
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

      {answered && (
        <>
          <p className={`testprep-question-result ${answer.correct ? 'testprep-question-result--correct' : 'testprep-question-result--wrong'}`}>
            {answer.correct ? t('studyGuide.correct') : t('studyGuide.wrong')}
          </p>
          {question.explanation && <p className="testprep-explanation-text">{question.explanation}</p>}
          <button type="button" className="btn btn-primary btn-block" onClick={handleNext}>
            {index + 1 < questions.length ? t('studyGuide.next') : t('studyGuide.seeScore')}
          </button>
        </>
      )}
    </div>
  )
}
