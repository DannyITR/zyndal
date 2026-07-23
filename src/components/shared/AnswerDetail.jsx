import { getSubject } from '../../lib/questions'
import TopBar from './TopBar'

export default function AnswerDetail({ entry, username, onBack, onLogout, onLogoClick }) {
  const subject = entry.subjectId ? getSubject(entry.subjectId) : null

  return (
    <div className="screen student-screen">
      <TopBar
        title={subject ? `${subject.icon} ${subject.name}` : 'Answer'}
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
            <span className="answer-summary-label">Your answer</span>
            <span
              className={`answer-summary-value ${
                entry.correct ? 'answer-summary-value--correct' : 'answer-summary-value--wrong'
              }`}
            >
              {entry.selectedAnswer ?? 'Not available'}
            </span>
          </div>
          <div className="answer-summary-row">
            <span className="answer-summary-label">Correct answer</span>
            <span className="answer-summary-value answer-summary-value--correct">
              {entry.correctAnswer ?? 'Not available'}
            </span>
          </div>
        </div>
      </div>

      <div className={`result-banner ${entry.correct ? 'result-banner--correct' : 'result-banner--wrong'}`}>
        <p className="result-headline">
          {entry.correct ? `Correct! +${entry.coinsEarned} coins · +${entry.xpEarned} XP` : "Not quite — you'll get it next time."}
        </p>
      </div>
    </div>
  )
}
