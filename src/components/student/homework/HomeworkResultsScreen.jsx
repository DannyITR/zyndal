import TopBar from '../../shared/TopBar'

export default function HomeworkResultsScreen({ user, assignment, result, onDone, onLogout, onLogoClick }) {
  const { scorePercentage, xpEarned, coinsEarned, late } = result

  return (
    <div className="screen student-screen">
      <TopBar title="📚 Homework Submitted" subtitle={assignment.title} username={user.username} onLogout={onLogout} onLogoClick={onLogoClick} />

      <div className="testprep-header-card practice-results-card homework-results-card">
        <div className="milestone-confetti" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="confetti-piece" style={{ '--i': i }} />
          ))}
        </div>
        <p className="practice-results-score">{scorePercentage}% correct</p>
        <p className="practice-results-coins">
          ⚡ +{xpEarned} XP{coinsEarned > 0 ? ` · 🪙 +${coinsEarned} coins` : ''}
        </p>
        {late && <p className="field-hint">Submitted after the due date — no coins for late homework.</p>}
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={onDone}>
        Done
      </button>
    </div>
  )
}
