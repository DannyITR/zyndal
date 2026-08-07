import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SUBJECTS, getSubject } from '../../../lib/questions'
import { getRecentPracticeSessions } from '../../../lib/storage'
import { buildPracticeQuestions } from '../../../lib/practice'
import { getErrorMessage } from '../../../lib/errors'
import TopBar from '../../shared/TopBar'

export default function PracticeSetupScreen({ user, lockedSubjectId, onStart, onBack, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const [subjectId, setSubjectId] = useState(lockedSubjectId || 'math')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recentSessions, setRecentSessions] = useState(null)

  useEffect(() => {
    let cancelled = false
    getRecentPracticeSessions(user.id, lockedSubjectId ? 20 : 5).then((list) => {
      if (!cancelled) setRecentSessions(list)
    })
    return () => {
      cancelled = true
    }
  }, [user.id, lockedSubjectId])

  const filteredRecentSessions = recentSessions
    ? lockedSubjectId
      ? recentSessions.filter((s) => s.subject === lockedSubjectId).slice(0, 5)
      : recentSessions
    : null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!topic.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      const questions = await buildPracticeQuestions({
        userId: user.id,
        subjectId,
        topic: topic.trim(),
        grade: user.grade || 9,
      })
      onStart({ subjectId, topic: topic.trim(), questions })
    } catch (err) {
      console.error('[Practice] question build failed:', err)
      setError(getErrorMessage(err, t))
      setLoading(false)
    }
  }

  return (
    <div className="screen student-screen">
      <TopBar
        title="📘 Practice"
        subtitle="Sharpen a specific topic"
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
        subscriptionStatus={user.subscription_status}
        daysRemainingInTrial={user.days_remaining_in_trial}
      />

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="practice-subject">Subject</label>
          {lockedSubjectId ? (
            <p className="field-static">
              {SUBJECTS.find((s) => s.id === lockedSubjectId)?.icon} {SUBJECTS.find((s) => s.id === lockedSubjectId)?.name}
            </p>
          ) : (
            <select id="practice-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="field">
          <label htmlFor="practice-topic">Topic</label>
          <input
            id="practice-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Quadratic equations"
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={!topic.trim() || loading}>
          {loading ? 'Building your practice set…' : 'Start Practice'}
        </button>
      </form>

      <h3 className="section-heading">Recent Practice</h3>
      {!filteredRecentSessions ? (
        <p className="loading-text">Loading…</p>
      ) : filteredRecentSessions.length === 0 ? (
        <p className="field-hint">No practice sessions yet.</p>
      ) : (
        <ul className="history-list">
          {filteredRecentSessions.map((s) => {
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
    </div>
  )
}
