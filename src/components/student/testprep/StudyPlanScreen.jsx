import { useState } from 'react'
import { SUBJECTS } from '../../../lib/questions'
import {
  countdownLabel,
  computeReadiness,
  isDayComplete,
  isDayUnlocked,
  progressKey,
} from '../../../lib/testprep'
import { updateStudyPlanData } from '../../../lib/storage'
import TopBar from '../../shared/TopBar'
import TestPrepQuestion from './TestPrepQuestion'

export default function StudyPlanScreen({ user, plan, onPlanUpdate, onBack, onLogout, onLogoClick }) {
  const [saveError, setSaveError] = useState('')
  const subject = SUBJECTS.find((s) => s.id === plan.subject)
  const subjectName = subject?.name || plan.subject
  const planData = plan.plan_data
  const readiness = computeReadiness(planData)

  async function handleFirstAttempt(day, questionIndex, selectedIndex, correct) {
    setSaveError('')
    const key = progressKey(day.day, questionIndex)
    const newPlanData = {
      ...planData,
      progress: { ...(planData.progress || {}), [key]: { selectedIndex, correct } },
    }
    try {
      await updateStudyPlanData(plan.id, newPlanData)
      onPlanUpdate({ ...plan, plan_data: newPlanData })
    } catch (err) {
      console.error('[TestPrep] progress save failed:', err)
      setSaveError("Couldn't save your answer. Check your connection and try again.")
      throw err
    }
  }

  return (
    <div className="screen student-screen">
      <TopBar
        title={`${subject?.icon || '📝'} ${subjectName} Test Prep`}
        subtitle={plan.topic}
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
        subscriptionStatus={user.subscription_status}
        daysRemainingInTrial={user.days_remaining_in_trial}
      />

      <div className="testprep-header-card">
        <p className="testprep-countdown">{countdownLabel(subjectName, plan.test_date)}</p>
        <div className="weekly-progress-bar">
          <div className="weekly-progress-fill" style={{ width: `${readiness}%` }} />
        </div>
        <p className="testprep-readiness">
          {readiness}% ready for your {subjectName} test
        </p>
      </div>

      {saveError && <p className="form-error">{saveError}</p>}

      {(planData.days || []).map((day) => {
        const unlocked = isDayUnlocked(plan, day)
        const complete = isDayComplete(planData, day)

        if (!unlocked) {
          return (
            <div key={day.day} className="testprep-day testprep-day--locked">
              <p className="testprep-day-title">
                🔒 Day {day.day}: {day.title}
              </p>
              <p className="field-hint">Unlocks tomorrow — one day at a time keeps it manageable.</p>
            </div>
          )
        }

        return (
          <div key={day.day} className="testprep-day">
            <p className="testprep-day-title">
              {complete ? '✅' : '📖'} Day {day.day}: {day.title}
            </p>
            <p className="testprep-day-focus">{day.focus}</p>

            <div className="testprep-lesson">
              {day.lesson.split('\n').filter(Boolean).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>

            {(day.questions || []).map((question, i) => (
              <TestPrepQuestion
                key={i}
                number={i + 1}
                question={question}
                firstAttempt={(planData.progress || {})[progressKey(day.day, i)]}
                onFirstAttempt={(selectedIndex, correct) => handleFirstAttempt(day, i, selectedIndex, correct)}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
