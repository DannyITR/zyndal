import { useTranslation } from 'react-i18next'
import { getEffectiveStreak, getWeeklyCorrectCount, PERFECT_WEEK_TARGET, todayStr } from '../../lib/streak'
import { getSubject } from '../../lib/questions'
import { LOCALE_FOR_LANGUAGE } from '../../lib/i18n'
import { averageGrade, computeSubjectAverages, computeTrend, gradeBand } from '../../lib/grades'
import HistoryList from '../shared/HistoryList'

function formatSubmissionDate(iso, language) {
  const locale = LOCALE_FOR_LANGUAGE[language] || 'en-US'
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

// Scratchpad is Math-only — other subjects may be added in future.
export default function StudentCard({ student, progress, practiceSessions = [], grades = [], workSubmissions = [], onSelectEntry }) {
  const { t, i18n } = useTranslation()
  const TREND_LABEL = {
    improving: t('studentCard.trendImproving'),
    declining: t('studentCard.trendDeclining'),
    steady: t('studentCard.trendSteady'),
  }
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
          <span className="mini-stat-label">{t('studentCard.streak')}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">🪙 {progress.coins}</span>
          <span className="mini-stat-label">{t('home.coins')}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-value">⚡ {progress.xp}</span>
          <span className="mini-stat-label">{t('home.xp')}</span>
        </div>
      </div>

      <div className="weekly-progress">
        <p className="weekly-progress-label">
          {t('studentCard.weeklyProgress', { name: displayName, count: weeklyCount, target: PERFECT_WEEK_TARGET })}
        </p>
        <div className="weekly-progress-bar">
          <div className="weekly-progress-fill" style={{ width: `${weeklyPct}%` }} />
        </div>
        <p className="weekly-progress-hint">
          {weeklyCount >= PERFECT_WEEK_TARGET
            ? t('studentCard.perfectWeekComplete')
            : t('studentCard.onTrackToEarn', { amount: perfectWeekBonus.toFixed(2) })}
        </p>
      </div>

      <details className="student-history">
        <summary>{t('studentCard.questionHistory', { count: progress.history.length })}</summary>
        <HistoryList
          history={progress.history}
          limit={20}
          emptyText={t('studentCard.noQuestionsAnswered')}
          onSelectEntry={onSelectEntry}
        />
      </details>

      <details className="student-history">
        <summary>{t('studentCard.recentPractice', { count: practiceSessions.length })}</summary>
        {practiceSessions.length === 0 ? (
          <p className="history-empty">{t('studentCard.noPracticeSessions')}</p>
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
                        {t(`subjects.${s.subject}`)} — {s.topic}
                      </p>
                      <p className="history-meta">
                        {s.completed_at.slice(0, 10)} · {t('studentCard.correctCount', { correct: s.questions_correct, total: s.questions_total })}
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
        <summary>{t('studentCard.workSubmissions', { count: workSubmissions.length })}</summary>
        {workSubmissions.length === 0 ? (
          <p className="history-empty">{t('studentCard.noWorkSubmitted')}</p>
        ) : (
          <ul className="history-list">
            {workSubmissions.map((w) => (
              <li key={w.id} className="history-item">
                <div className="history-item-row history-item-row--static">
                  <span className="history-icon">📐</span>
                  <div className="history-body">
                    <p className="history-prompt">{w.questionText}</p>
                    <p className="history-meta">
                      {w.correctAfterHint
                        ? t('studentCard.correctAfterHint', { date: formatSubmissionDate(w.submittedAt, i18n.language) })
                        : formatSubmissionDate(w.submittedAt, i18n.language)}
                    </p>
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
        <summary>{t('studentCard.myGrades', { count: grades.length })}</summary>
        {grades.length === 0 ? (
          <p className="history-empty">{t('studentCard.noGradesLogged')}</p>
        ) : (
          <>
            <div className="grades-overall-mini">
              <span>
                {t('studentCard.overallLabel')} <strong className={`grade-text--${gradeBand(overallGradeAverage)}`}>{overallGradeAverage}%</strong>
              </span>
              {gradeTrend && <span className="grades-trend-badge">{TREND_LABEL[gradeTrend]}</span>}
            </div>

            <div className="grades-subject-averages">
              {Object.entries(subjectGradeAverages).map(([subjectId, avg]) => {
                const subject = getSubject(subjectId)
                return (
                  <div key={subjectId} className="grades-subject-average-row">
                    <span>{t('studentCard.subjectAverage', { subject: `${subject?.icon} ${t(`subjects.${subjectId}`)}` })}</span>
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
                        {subject?.icon} {t(`subjects.${g.subject}`)} — {g.test_name}
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
