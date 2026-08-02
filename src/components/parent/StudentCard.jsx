import { getEffectiveStreak, getWeeklyCorrectCount, PERFECT_WEEK_TARGET, todayStr } from '../../lib/streak'
import { getSubject } from '../../lib/questions'
import { averageGrade, computeSubjectAverages, computeTrend, gradeBand } from '../../lib/grades'
import HistoryList from '../shared/HistoryList'

const TREND_LABEL = { improving: '📈 Improving', declining: '📉 Needs attention', steady: '➡️ Steady' }

function formatSubmissionDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Scratchpad is Math-only — other subjects may be added in future.
export default function StudentCard({ student, progress, practiceSessions = [], grades = [], workSubmissions = [], onSelectEntry }) {
  const streak = getEffectiveStreak(progress, todayStr())
  const weeklyCount = getWeeklyCorrectCount(progress.history)
  const weeklyPct = Math.min(100, Math.round((weeklyCount / PERFECT_WEEK_TARGET) * 100))
  const perfectWeekBonus = Number(student.perfectWeekBonus ?? 10)
  const displayName = student.display_name || student.username
  const overallGradeAverage = averageGrade(grades)
  const subjectGradeAverages = computeSubjectAverages(grades)
  const gradeTrend = computeTrend(grades)

  return (
    <div className="student-card">
      <div className="student-card-header">
        <div>
          <p className="student-card-name">@{student.username}</p>
        </div>
      </div>

      <div className="student-card-stats">
        <div className="mini-stat">
          <span className="mini-stat-value">🔥 {streak}</span>
          <span className="mini-stat-label">streak</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">🪙 {progress.coins}</span>
          <span className="mini-stat-label">coins</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">⚡ {progress.xp}</span>
          <span className="mini-stat-label">XP</span>
        </div>
      </div>

      <div className="weekly-progress">
        <p className="weekly-progress-label">
          {displayName} has answered {weeklyCount}/{PERFECT_WEEK_TARGET} questions correctly this week
        </p>
        <div className="weekly-progress-bar">
          <div className="weekly-progress-fill" style={{ width: `${weeklyPct}%` }} />
        </div>
        <p className="weekly-progress-hint">
          {weeklyCount >= PERFECT_WEEK_TARGET
            ? 'Perfect week complete! 🎉'
            : `On track to earn $${perfectWeekBonus.toFixed(2)} this week`}
        </p>
      </div>

      <details className="student-history">
        <summary>Question history ({progress.history.length})</summary>
        <HistoryList
          history={progress.history}
          limit={20}
          emptyText="No questions answered yet."
          onSelectEntry={onSelectEntry}
        />
      </details>

      <details className="student-history">
        <summary>Recent Practice ({practiceSessions.length})</summary>
        {practiceSessions.length === 0 ? (
          <p className="history-empty">No practice sessions yet.</p>
        ) : (
          <ul className="history-list">
            {practiceSessions.map((s) => {
              const subject = getSubject(s.subject)
              return (
                <li key={s.id} className="history-item">
                  <div className="history-item-row history-item-row--static">
                    <span className="history-icon">{subject?.icon || '📘'}</span>
                    <div className="history-body">
                      <p className="history-prompt">
                        {subject?.name || s.subject} — {s.topic}
                      </p>
                      <p className="history-meta">
                        {s.completed_at.slice(0, 10)} · {s.questions_correct}/{s.questions_total} correct
                      </p>
                    </div>
                    <span className="history-reward">🪙 +{s.coins_earned}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </details>

      <details className="student-history">
        <summary>Math Work Submissions ({workSubmissions.length})</summary>
        {workSubmissions.length === 0 ? (
          <p className="history-empty">No work submitted yet.</p>
        ) : (
          <ul className="history-list">
            {workSubmissions.map((w) => (
              <li key={w.id} className="history-item">
                <div className="history-item-row history-item-row--static">
                  <span className="history-icon">📐</span>
                  <div className="history-body">
                    <p className="history-prompt">{w.questionText}</p>
                    <p className="history-meta">{formatSubmissionDate(w.submittedAt)}</p>
                  </div>
                  <span className={w.approved ? 'answer-review-correct' : 'answer-review-wrong'}>
                    {w.approved ? '✅' : '❌'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="student-history">
        <summary>My Grades ({grades.length})</summary>
        {grades.length === 0 ? (
          <p className="history-empty">No grades logged yet.</p>
        ) : (
          <>
            <div className="grades-overall-mini">
              <span>
                Overall: <strong className={`grade-text--${gradeBand(overallGradeAverage)}`}>{overallGradeAverage}%</strong>
              </span>
              {gradeTrend && <span className="grades-trend-badge">{TREND_LABEL[gradeTrend]}</span>}
            </div>

            <div className="grades-subject-averages">
              {Object.entries(subjectGradeAverages).map(([subjectId, avg]) => {
                const subject = getSubject(subjectId)
                return (
                  <div key={subjectId} className="grades-subject-average-row">
                    <span>
                      {subject?.icon} {subject?.name || subjectId} average
                    </span>
                    <span className={`grade-text--${gradeBand(avg)}`}>{avg}%</span>
                  </div>
                )
              })}
            </div>

            <ul className="grades-list">
              {grades.map((g) => {
                const subject = getSubject(g.subject)
                return (
                  <li key={g.id} className={`grades-row grades-row--${gradeBand(g.grade_percentage)}`}>
                    <div className="grades-row-info">
                      <p className="grades-row-title">
                        {subject?.icon} {subject?.name || g.subject} — {g.test_name}
                      </p>
                      <p className="grades-row-detail">{g.test_date}</p>
                    </div>
                    <span className={`grades-row-percentage grade-text--${gradeBand(g.grade_percentage)}`}>
                      {g.grade_percentage}%
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </details>
    </div>
  )
}
