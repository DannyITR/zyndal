import { useEffect, useState } from 'react'
import { SUBJECTS, getSubject, gradeToSecondary } from '../../../lib/questions'
import { todayStr } from '../../../lib/streak'
import { daysUntil } from '../../../lib/testprep'
import { getUploadedQuestionsForSubject, hasAnyUploadsForSubject, createStudyPlan, getPastStudyPlans } from '../../../lib/storage'
import { generateStudyPlan } from '../../../lib/ai'
import { saveSourcePreference, buildPlanDaysFromUploads, mixPlanDays } from '../../../lib/questionSource'
import TopBar from '../../shared/TopBar'
import QuestionSourceStep from './QuestionSourceStep'

export default function TestPrepSetupScreen({ user, lockedSubjectId, onPlanCreated, onBack, onLogout, onLogoClick }) {
  const [step, setStep] = useState('form') // 'form' | 'source'
  const [subjectId, setSubjectId] = useState(lockedSubjectId || 'math')
  const [topic, setTopic] = useState('')
  const [testDate, setTestDate] = useState('')
  const [grade, setGrade] = useState(user.grade ? String(user.grade) : '')
  const [uploadedQuestions, setUploadedQuestions] = useState([])
  const [hasAnyUploads, setHasAnyUploads] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [pastPlans, setPastPlans] = useState(null)

  useEffect(() => {
    let cancelled = false
    getPastStudyPlans(user.id).then((list) => {
      if (!cancelled) setPastPlans(list)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  const subject = SUBJECTS.find((s) => s.id === subjectId)
  const canSubmit = topic.trim() && testDate && grade && !generating
  const filteredPastPlans = pastPlans
    ? lockedSubjectId
      ? pastPlans.filter((p) => p.subject === lockedSubjectId)
      : pastPlans
    : []

  async function handleFormSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    try {
      const [questions, anyUploads] = await Promise.all([
        getUploadedQuestionsForSubject(user.id, subjectId),
        hasAnyUploadsForSubject(user.id, subjectId),
      ])
      setUploadedQuestions(questions)
      setHasAnyUploads(anyUploads)
      setStep('source')
    } catch (err) {
      console.error('[TestPrep] could not check uploaded questions:', err)
      setError(err.message || "Couldn't load your uploads. Please try again.")
    }
  }

  async function handleGenerate(source) {
    setGenerating(true)
    setError('')
    saveSourcePreference(subjectId, source)
    try {
      // "In X days" where the test being today or tomorrow both mean 1 day
      // of prep — the plan generator's single-day mode.
      const daysAvailable = Math.max(1, daysUntil(testDate))

      let planData
      if (source === 'uploads') {
        planData = { days: buildPlanDaysFromUploads(uploadedQuestions, daysAvailable, topic.trim()) }
      } else {
        const aiData = await generateStudyPlan({ grade: Number(grade), subject: subject.name, topic: topic.trim(), daysAvailable })
        planData = source === 'mix' ? { days: mixPlanDays(uploadedQuestions, aiData.days) } : aiData
      }

      const plan = await createStudyPlan({
        userId: user.id,
        subject: subjectId,
        topic: topic.trim(),
        testDate,
        daysAvailable,
        gradeLevel: Number(grade),
        planData,
      })
      onPlanCreated(plan)
    } catch (err) {
      console.error('[TestPrep] plan generation failed:', err)
      setError(err.message || "Couldn't generate your study plan. Please try again.")
      setGenerating(false)
    }
  }

  if (step === 'source') {
    return (
      <QuestionSourceStep
        user={user}
        subjectId={subjectId}
        subjectName={subject.name}
        uploadCount={uploadedQuestions.length}
        hasAnyUploads={hasAnyUploads}
        generating={generating}
        error={error}
        onContinue={handleGenerate}
        onBack={() => setStep('form')}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />
    )
  }

  return (
    <div className="screen student-screen">
      <TopBar
        title="📝 Test Prep"
        subtitle="Tell us about your test"
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <form className="auth-form" onSubmit={handleFormSubmit}>
        <div className="field">
          <label htmlFor="testprep-subject">Subject</label>
          {lockedSubjectId ? (
            <p className="field-static">
              {subject.icon} {subject.name}
            </p>
          ) : (
            <select id="testprep-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="field">
          <label htmlFor="testprep-topic">What's the test on?</label>
          <input
            id="testprep-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Quadratic equations"
          />
        </div>

        <div className="field">
          <label htmlFor="testprep-date">Test date</label>
          <input
            id="testprep-date"
            type="date"
            min={todayStr()}
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="testprep-grade">Grade level</label>
          <select id="testprep-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Select grade</option>
            <option value="9">Secondary {gradeToSecondary(9)}</option>
            <option value="10">Secondary {gradeToSecondary(10)}</option>
            <option value="11">Secondary {gradeToSecondary(11)}</option>
          </select>
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit}>
          Choose Your Questions
        </button>
      </form>

      <h3 className="section-heading">Past Plans</h3>
      {!pastPlans ? (
        <p className="loading-text">Loading…</p>
      ) : filteredPastPlans.length === 0 ? (
        <p className="field-hint">Plans you complete or cancel will show up here.</p>
      ) : (
        <div className="plan-history-list">
          {filteredPastPlans.map((plan) => {
            const planSubject = getSubject(plan.subject)
            return (
              <div key={plan.id} className="plan-history-row">
                <div className="plan-history-info">
                  <p className="plan-history-title">
                    {planSubject?.icon || ''} {planSubject?.name || plan.subject} — {plan.topic}
                  </p>
                  <p className="plan-history-detail">Test date: {plan.test_date}</p>
                </div>
                <span className={`plan-status-badge plan-status-badge--${plan.status}`}>
                  {plan.status === 'completed' ? 'Completed' : 'Cancelled'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
