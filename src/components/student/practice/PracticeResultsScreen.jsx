import TopBar from '../../shared/TopBar'

export default function PracticeResultsScreen({ user, subjectName, topic, result, onDone, onLogout, onLogoClick }) {
  const { questionsCorrect, questionsTotal, coinsEarned } = result
  const wrongCount = questionsTotal - questionsCorrect

  return (
    <div className="screen student-screen">
      <TopBar
        title="📘 Practice Results"
        subtitle={`${subjectName} — ${topic}`}
        username={user.username}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
        subscriptionStatus={user.subscription_status}
        daysRemainingInTrial={user.days_remaining_in_trial}
      />

      <div className="testprep-header-card practice-results-card">
        <p className="practice-results-score">
          {questionsCorrect}/{questionsTotal} correct
        </p>
        <p className="practice-results-coins">🪙 +{coinsEarned} coins earned this session</p>
        {wrongCount > 2 && <p className="field-hint practice-results-weak">Review {topic} before your next test</p>}
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={onDone}>
        Back to Practice
      </button>
    </div>
  )
}
