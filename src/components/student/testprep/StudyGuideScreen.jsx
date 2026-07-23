import { useEffect, useState } from 'react'
import { todayStr } from '../../../lib/streak'
import { generateStudyGuide, getTodaysGuideSubject } from '../../../lib/ai'
import TopBar from '../../shared/TopBar'
import TestPrepQuestion from './TestPrepQuestion'

// The guide (questions + the student's answers) is cached per user per day in
// localStorage — it regenerates fresh each day, and a page reload doesn't
// burn another API call or reset answered questions. No coins or XP are
// awarded here — those only come from the daily question.
function cacheKey(userId, subjectId) {
  return `zyndal_study_guide_${userId}_${subjectId}_${todayStr()}`
}

function readCache(userId, subjectId) {
  try {
    const raw = localStorage.getItem(cacheKey(userId, subjectId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(userId, subjectId, guide) {
  try {
    localStorage.setItem(cacheKey(userId, subjectId), JSON.stringify(guide))
  } catch {
    // Cache is best-effort — a full localStorage just means a regenerate on reload.
  }
}

export default function StudyGuideScreen({ user, subject: lockedSubject, onBack, onLogout, onLogoClick }) {
  const subject = lockedSubject || getTodaysGuideSubject()
  const [guide, setGuide] = useState(() => readCache(user.id, subject.id))
  const [loading, setLoading] = useState(!guide)
  const [error, setError] = useState('')

  useEffect(() => {
    if (guide) return
    let cancelled = false
    generateStudyGuide({ grade: user.grade || 9, subjectName: subject.name })
      .then((generated) => {
        if (cancelled) return
        const fresh = { ...generated, subjectId: subject.id, progress: {} }
        writeCache(user.id, subject.id, fresh)
        setGuide(fresh)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[StudyGuide] generation failed:', err)
        setError(err.message || "Couldn't generate today's study guide. Please try again.")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [guide, user.id, user.grade, subject.id, subject.name])

  function handleFirstAttempt(questionIndex, selectedIndex, correct) {
    const updated = {
      ...guide,
      progress: { ...(guide.progress || {}), [questionIndex]: { selectedIndex, correct } },
    }
    writeCache(user.id, subject.id, updated)
    setGuide(updated)
  }

  return (
    <div className="screen student-screen">
      <TopBar
        title="📚 Study Guide"
        subtitle="Fresh questions every day"
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      {loading && (
        <p className="loading-text">Generating today's study guide… (this can take a minute)</p>
      )}

      {error && <p className="form-error">{error}</p>}

      {guide && (
        <>
          <div className="testprep-header-card">
            <p className="testprep-countdown">
              Today's Study Guide — {subject.icon} {subject.name} — {guide.topic}
            </p>
            <p className="field-hint">No test scheduled? This keeps you sharp anyway.</p>
          </div>

          {(guide.questions || []).map((question, i) => (
            <TestPrepQuestion
              key={i}
              number={i + 1}
              question={question}
              firstAttempt={(guide.progress || {})[i]}
              onFirstAttempt={(selectedIndex, correct) => handleFirstAttempt(i, selectedIndex, correct)}
            />
          ))}
        </>
      )}
    </div>
  )
}
