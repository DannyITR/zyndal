import { useTranslation } from 'react-i18next'
import { getSubject } from '../../lib/questions'
import TopBar from './TopBar'

export default function AnswerDetail({ entry, username, onBack, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const subject = entry.subjectId ? getSubject(entry.subjectId) : null

  return (
    <div className="screen student-screen">
      <TopBar
        title={subject ? `${subject.icon} ${t(`subjects.${subject.id}`)}` : t('answerDetail.defaultTitle')}
        subtitle={entry.date}
        username={username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <div className="question-card">
        <p className="question-meta">{entry.date}</p>
        <h2 className="question-prompt">{entry.prompt}</h2>

        <div className="answer-summary">
          <div className="answer-summary-row">
            <span className="answer-summary-label">{t('answerDetail.yourAnswer')}</span>
            <span
              className={`answer-summary-value ${
                entry.correct ? 'answer-summary-value--correct' : 'answer-summary-value--wrong'
              }`}
            >
              {entry.selectedAnswer ?? t('answerDetail.notAvailable')}
            </span>
          </div>
          <div className="answer-summary-row">
            <span className="answer-summary-label">{t('answerDetail.correctAnswerLabel')}</span>
            <span className="answer-summary-value answer-summary-value--correct">
              {entry.correctAnswer ?? t('answerDetail.notAvailable')}
            </span>
          </div>
        </div>
      </div>

      <div className={`result-banner ${entry.correct ? 'result-banner--correct' : 'result-banner--wrong'}`}>
        <p className="result-headline">
          {entry.correct
            ? t('answerDetail.correctResult', { coins: entry.coinsEarned, xp: entry.xpEarned })
            : t('answerDetail.wrongResult')}
        </p>
      </div>
    </div>
  )
}
