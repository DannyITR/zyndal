import TopBar from '../../shared/TopBar'

export default function HomeworkResultsScreen({ user, assignment, result, onDone, onLogout, onLogoClick }) {
  const { scorePercentage, xpEarned, coinsEarned, late } = result

  return (
    <div className="screen student-screen">
      <TopBar title="📚 Homework Submitted" subtitle={assignment.title} username={user.username} onLogout={onLogout} onLogoClick={onLogoClick} />

      <div className="testprep-header-card practice-results-card">
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
