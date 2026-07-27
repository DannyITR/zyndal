import { useEffect, useState } from 'react'
import { todayStr } from '../../../lib/streak'
import { generateStudyGuide, getTodaysGuideSubject } from '../../../lib/ai'
import { getUploadedQuestionsForSubject } from '../../../lib/storage'
import { saveSourcePreference, buildGuideFromUploads, mixGuideQuestions } from '../../../lib/questionSource'
import TopBar from '../../shared/TopBar'
import TestPrepQuestion from './TestPrepQuestion'
import QuestionSourceStep from './QuestionSourceStep'

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
  // Skipped entirely once today's guide is already cached — the source
  // picker only shows up the first time a student opens it each day.
  const [step, setStep] = useState(() => (readCache(user.id, subject.id) ? 'guide' : 'source'))
  const [uploadedQuestions, setUploadedQuestions] = useState([])
  const [uploadsLoaded, setUploadsLoaded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (step !== 'source') return
    let cancelled = false
    getUploadedQuestionsForSubject(user.id, subject.id)
      .then((questions) => {
        if (cancelled) return
        setUploadedQuestions(questions)
        setUploadsLoaded(true)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[StudyGuide] could not check uploads:', err)
        setUploadedQuestions([])
        setUploadsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [step, user.id, subject.id])

  async function handleGenerate(source) {
    setGenerating(true)
    setError('')
    saveSourcePreference(subject.id, source)
    try {
      let result
      if (source === 'uploads') {
        result = buildGuideFromUploads(uploadedQuestions, subject.name)
      } else {
        const aiGuide = await generateStudyGuide({ grade: user.grade || 9, subjectName: subject.name })
        result = source === 'mix' ? mixGuideQuestions(uploadedQuestions, aiGuide) : aiGuide
      }
      const fresh = { ...result, subjectId: subject.id, progress: {} }
      writeCache(user.id, subject.id, fresh)
      setGuide(fresh)
      setStep('guide')
    } catch (err) {
      console.error('[StudyGuide] generation failed:', err)
      setError(err.message || "Couldn't generate today's study guide. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  function handleFirstAttempt(questionIndex, selectedIndex, correct) {
    const updated = {
      ...guide,
      progress: { ...(guide.progress || {}), [questionIndex]: { selectedIndex, correct } },
    }
    writeCache(user.id, subject.id, updated)
    setGuide(updated)
  }

  if (step === 'source') {
    if (!uploadsLoaded) {
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
          <p className="loading-text">Loading…</p>
        </div>
      )
    }
    return (
      <QuestionSourceStep
        user={user}
        subjectId={subject.id}
        subjectName={subject.name}
        uploadCount={uploadedQuestions.length}
        generating={generating}
        error={error}
        onContinue={handleGenerate}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />
    )
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
