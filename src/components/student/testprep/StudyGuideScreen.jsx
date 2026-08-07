import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { todayStr } from '../../../lib/streak'
import { getErrorMessage } from '../../../lib/errors'
import { generateStudyGuide, getTodaysGuideSubject } from '../../../lib/ai'
import { getUploadedContentForSubject } from '../../../lib/storage'
import {
  saveSourcePreference,
  countUsableUploads,
  resolveUploadQuestionPool,
  resolveGenerationLanguage,
  buildGuideFromUploads,
  mixGuideQuestions,
} from '../../../lib/questionSource'
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
  const { t } = useTranslation()
  const subject = lockedSubject || getTodaysGuideSubject()
  const [guide, setGuide] = useState(() => readCache(user.id, subject.id))
  // Always shown first, even if today's guide is already cached — picking a
  // source is how the student starts a guide, not just a one-time-per-day
  // fork. If they re-pick the same source Continue reuses the cached guide
  // (and its progress) instead of burning another generation — see
  // handleGenerate below.
  const [step, setStep] = useState('source')
  const [uploadContent, setUploadContent] = useState([])
  const [uploadsLoaded, setUploadsLoaded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingLabel, setGeneratingLabel] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (step !== 'source') return
    let cancelled = false
    getUploadedContentForSubject(user.id, subject.id)
      .then((content) => {
        if (cancelled) return
        setUploadContent(content)
        setUploadsLoaded(true)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[StudyGuide] could not check uploads:', err)
        setUploadContent([])
        setUploadsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [step, user.id, subject.id])

  async function handleGenerate(source) {
    setError('')
    saveSourcePreference(subject.id, source)

    // Reuse today's guide if it was already generated from this same
    // source — keeps recorded progress and avoids a pointless regenerate
    // when the student is just re-opening what they already started today.
    const cached = readCache(user.id, subject.id)
    if (cached && cached.source === source) {
      setGuide(cached)
      setStep('guide')
      return
    }

    setGenerating(true)
    setGeneratingLabel('')
    try {
      let result
      if (source === 'ai') {
        const language = resolveGenerationLanguage(user)
        result = await generateStudyGuide({ grade: user.grade || 9, subjectName: subject.name, language })
      } else {
        const { pool: uploadedQuestions, language } = await resolveUploadQuestionPool(
          user.id,
          subject.id,
          subject.name,
          user.grade || 9,
          setGeneratingLabel
        )
        if (source === 'uploads') {
          if (uploadedQuestions.length === 0) throw new Error("Couldn't build questions from your uploads. Please try Curriculum Guide instead.")
          result = buildGuideFromUploads(uploadedQuestions, subject.name)
        } else {
          setGeneratingLabel('')
          const aiGuide = await generateStudyGuide({ grade: user.grade || 9, subjectName: subject.name, language })
          result = mixGuideQuestions(uploadedQuestions, aiGuide)
        }
      }
      const fresh = { ...result, subjectId: subject.id, progress: {}, source }
      writeCache(user.id, subject.id, fresh)
      setGuide(fresh)
      setStep('guide')
    } catch (err) {
      console.error('[StudyGuide] generation failed:', err)
      setError(getErrorMessage(err, t))
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
            subscriptionStatus={user.subscription_status}
            daysRemainingInTrial={user.days_remaining_in_trial}
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
        uploadCount={countUsableUploads(uploadContent)}
        hasAnyUploads={uploadContent.length > 0}
        generating={generating}
        generatingLabel={generatingLabel}
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
        subscriptionStatus={user.subscription_status}
        daysRemainingInTrial={user.days_remaining_in_trial}
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
