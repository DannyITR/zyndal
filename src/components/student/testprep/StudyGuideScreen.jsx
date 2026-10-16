import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { todayStr } from '../../../lib/streak'
import { getErrorMessage } from '../../../lib/errors'
import { generateStudyGuide, getTodaysGuideSubject } from '../../../lib/ai'
import { getUploadedContentForSubject, countStudyGuideQuestions, getStudyGuideQuestions, generatePracticeQuestions } from '../../../lib/storage'
import { saveSourcePreference, countUsableUploads, resolveUploadQuestionPool, resolveGenerationLanguage, mixGuideQuestions } from '../../../lib/questionSource'
import TopBar from '../../shared/TopBar'
import TestPrepQuestion from './TestPrepQuestion'
import QuestionSourceStep from './QuestionSourceStep'
import PrintableQuizSection from './PrintableQuizSection'
import StudyGuidePractice from './StudyGuidePractice'

// The "From your uploaded materials" source's question-count choices.
// 'all' is always on offer; a number above what's available is disabled.
const COUNT_CHOICES = [10, 20, 30, 'all']

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
  // A course added from another grade (user.courseGrade — see
  // src/lib/additionalCourses.js) keeps its own day's guide, so Gr 10 and
  // Gr 11 Math don't overwrite each other's cached guide.
  const cacheSubjectKey = user.courseGrade ? `${subject.id}_g${user.courseGrade}` : subject.id
  const [guide, setGuide] = useState(() => readCache(user.id, cacheSubjectKey))
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
  // "From your uploaded materials": the uploads ticked in the list below
  // (shared with the printable quiz), how many saved questions they have
  // (null until known), and how many the student wants. Nothing ticked
  // means every upload for the subject.
  const [selectedUploadIds, setSelectedUploadIds] = useState([])
  const [availableCount, setAvailableCount] = useState(null)
  const [countChoice, setCountChoice] = useState(10)
  const [writingQuestions, setWritingQuestions] = useState(false)
  const [writeResult, setWriteResult] = useState('')
  const tickedUploadIds = uploadContent.map((u) => u.uploadId).filter((id) => selectedUploadIds.includes(id))
  const practiceUploadIds = tickedUploadIds.length > 0 ? tickedUploadIds : uploadContent.map((u) => u.uploadId)
  const practiceKey = practiceUploadIds.join(',')

  useEffect(() => {
    if (step !== 'source') return
    let cancelled = false
    getUploadedContentForSubject(user.id, subject.id, user.courseGrade)
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
  }, [step, user.id, subject.id, user.courseGrade])

  // Recounted whenever the ticked uploads change.
  useEffect(() => {
    if (step !== 'source' || !practiceKey) return
    let cancelled = false
    setAvailableCount(null)
    countStudyGuideQuestions(practiceKey.split(','))
      .then((available) => {
        if (cancelled) return
        setAvailableCount(available)
        // Default to 10, or everything when there aren't more than 10.
        setCountChoice((prev) => (prev !== 'all' && prev > available ? 'all' : prev))
      })
      .catch((err) => console.error('[StudyGuide] could not count upload questions:', err))
    return () => {
      cancelled = true
    }
  }, [step, practiceKey])

  // "Write new practice questions": a fresh set of 4-option questions from
  // the ticked uploads (or all of them), added to their saved questions so
  // the practice — and the printable quiz — have more to draw from.
  async function handleWriteQuestions() {
    if (writingQuestions || generating) return
    setWritingQuestions(true)
    setWriteResult('')
    setError('')
    try {
      const { added, available } = await generatePracticeQuestions(practiceUploadIds)
      setAvailableCount(available)
      setWriteResult(added > 0 ? t('studyGuide.wroteQuestions', { count: added }) : t('studyGuide.wroteNone'))
    } catch (err) {
      console.error('[StudyGuide] could not write practice questions:', err)
      setError(getErrorMessage(err, t))
    } finally {
      setWritingQuestions(false)
    }
  }

  // "From your uploaded materials" reuses the questions already saved on the
  // ticked uploads (see api/study-guide-questions.js) — the same pool as the
  // printable quiz — rather than writing a new set. Continue resumes an
  // unfinished run from today with the same uploads and size; otherwise it
  // picks a fresh random set.
  async function startUploadsPractice() {
    const cached = readCache(user.id, cacheSubjectKey)
    if (
      cached?.source === 'uploads' &&
      cached.count === countChoice &&
      cached.uploadKey === practiceKey &&
      cached.session &&
      cached.session.index < cached.session.questions.length
    ) {
      setGuide(cached)
      setStep('guide')
      return
    }

    setGenerating(true)
    setGeneratingLabel(t('studyGuide.loadingQuestions'))
    try {
      const questions = await getStudyGuideQuestions(practiceUploadIds, countChoice)
      const fresh = { source: 'uploads', subjectId: subject.id, count: countChoice, uploadKey: practiceKey, session: { questions, index: 0, answers: [] } }
      writeCache(user.id, cacheSubjectKey, fresh)
      setGuide(fresh)
      setStep('guide')
    } catch (err) {
      console.error('[StudyGuide] could not load upload questions:', err)
      setError(getErrorMessage(err, t))
    } finally {
      setGenerating(false)
    }
  }

  function handleSessionChange(session) {
    const updated = { ...guide, session }
    writeCache(user.id, cacheSubjectKey, updated)
    setGuide(updated)
  }

  async function handleGenerate(source) {
    setError('')
    saveSourcePreference(subject.id, source)
    if (source === 'uploads') return startUploadsPractice()

    // Reuse today's guide if it was already generated from this same
    // source — keeps recorded progress and avoids a pointless regenerate
    // when the student is just re-opening what they already started today.
    const cached = readCache(user.id, cacheSubjectKey)
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
        // 'mix' — 'uploads' returned early above (startUploadsPractice).
        const { pool: uploadedQuestions, language } = await resolveUploadQuestionPool(
          user.id,
          subject.id,
          subject.name,
          user.grade || 9,
          setGeneratingLabel,
          user.courseGrade
        )
        setGeneratingLabel('')
        const aiGuide = await generateStudyGuide({ grade: user.grade || 9, subjectName: subject.name, language })
        result = mixGuideQuestions(uploadedQuestions, aiGuide)
      }
      const fresh = { ...result, subjectId: subject.id, progress: {}, source }
      writeCache(user.id, cacheSubjectKey, fresh)
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
    writeCache(user.id, cacheSubjectKey, updated)
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
    // Every notes/study-material upload for this subject can go into a
    // printable quiz package — never a graded test, which is a record of a
    // past result rather than material to study from. Available to every user.
    const quizUploads = uploadContent.filter((upload) => upload.documentType !== 'test')
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
        renderSourceExtras={(selected) =>
          selected === 'uploads' && (
            <div className="study-guide-count">
              <p className="field-hint">
                {tickedUploadIds.length > 0 ? t('studyGuide.practiceFromTicked', { count: tickedUploadIds.length }) : t('studyGuide.practiceFromAll')}{' '}
                {t('studyGuide.tickHint')}
              </p>
              <p className="study-guide-count-label">
                {t('studyGuide.countLabel')}{' '}
                <span className="field-hint">{availableCount === null ? t('studyGuide.counting') : t('studyGuide.available', { count: availableCount })}</span>
              </p>
              <div className="segmented-toggle" role="group" aria-label={t('studyGuide.countLabel')}>
                {COUNT_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={`segmented-toggle-btn ${countChoice === choice ? 'segmented-toggle-btn--active' : ''}`}
                    aria-pressed={countChoice === choice}
                    disabled={generating || writingQuestions || availableCount === null || (choice !== 'all' && choice > availableCount)}
                    onClick={() => setCountChoice(choice)}
                  >
                    {choice === 'all' ? t('studyGuide.all') : choice}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-secondary btn-block" disabled={generating || writingQuestions} onClick={handleWriteQuestions}>
                {writingQuestions ? t('studyGuide.writingQuestions') : t('studyGuide.writeQuestions')}
              </button>
              {writeResult && <p className="study-guide-write-result">{writeResult}</p>}
            </div>
          )
        }
      >
        <PrintableQuizSection
          uploads={quizUploads}
          accountEmail={user.email}
          hint={t('studyQuiz.sectionHint')}
          disabled={generating || writingQuestions}
          selection={selectedUploadIds}
          onSelectionChange={setSelectedUploadIds}
        />
      </QuestionSourceStep>
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

      {guide?.source === 'uploads' && guide.session && (
        <>
          <div className="testprep-header-card">
            <p className="testprep-countdown">
              {subject.icon} {subject.name} — {t('studyGuide.fromYourUploads')}
            </p>
          </div>
          <StudyGuidePractice session={guide.session} onChange={handleSessionChange} />
        </>
      )}

      {guide && guide.source !== 'uploads' && (
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
