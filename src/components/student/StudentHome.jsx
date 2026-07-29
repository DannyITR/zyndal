import { useMemo, useState } from 'react'
import { submitAnswer, submitLateAnswer } from '../../lib/storage'
import { getDailyQuestion } from '../../lib/questions'
import { getEffectiveStreak, countCorrectSubjectsToday, todayStr, TOTAL_SUBJECTS, formatLongDate } from '../../lib/streak'
import { getUserTimeZone } from '../../lib/timezone'
import { countdownLabel, computeReadiness } from '../../lib/testprep'
import TopBar from '../shared/TopBar'
import StreakFlame from './StreakFlame'
import StatPill from './StatPill'
import QuestionCard from './QuestionCard'
import MilestoneModal from './MilestoneModal'
import PerfectWeekCelebration from './PerfectWeekCelebration'
import GoPremiumModal from './testprep/GoPremiumModal'
import CancelTestPlanModal from './testprep/CancelTestPlanModal'

export default function StudentHome({
  user,
  subject,
  progress,
  onProgressChange,
  date,
  onLateAnswered,
  activePlan,
  isPremium,
  onOpenTestPrep,
  onOpenStudyGuide,
  onOpenStudyPlan,
  onMarkDonePlan,
  onCancelPlan,
  onOpenUpload,
  onOpenMyUploads,
  onOpenPractice,
  onOpenGrades,
  onOpenCurriculum,
  onBack,
  onLogout,
  onLogoClick,
}) {
  const today = todayStr(new Date(), getUserTimeZone())
  const isToday = date === today

  // Today's question/retry/milestone state — only relevant when isToday.
  const question = useMemo(() => getDailyQuestion(subject.id), [subject.id])
  // The scored first attempt persisted this session: { selectedIndex, correct, coinsEarned, xpEarned }
  const [justAnswered, setJustAnswered] = useState(null)
  // The most recent retry pick after a wrong first attempt — local only, never persisted or rewarded.
  const [retryAttempt, setRetryAttempt] = useState(null)
  const [milestone, setMilestone] = useState(null)
  const [perfectWeekBonus, setPerfectWeekBonus] = useState(null) // dollars, or null
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Past-date "Answer now" catch-up flow — only relevant when !isToday. Earns
  // XP only via api/student/submit-late-answer.js (see StudentFlow.jsx's
  // handleLateAnswered for why coins/streak never move).
  const [answeringPast, setAnsweringPast] = useState(false)
  const [pastSelectedIndex, setPastSelectedIndex] = useState(null)
  const [pastSubmitting, setPastSubmitting] = useState(false)
  const [pastSubmitError, setPastSubmitError] = useState('')
  const pastQuestion = useMemo(
    () => (isToday ? null : getDailyQuestion(subject.id, new Date(`${date}T12:00:00Z`))),
    [isToday, subject.id, date]
  )
  const activeQuestion = isToday ? question : pastQuestion

  const planForThisSubject = activePlan && activePlan.subject === subject.id ? activePlan : null

  // Test Prep and the Study Guide are premium features; free students see the
  // upgrade pitch instead.
  function handleOpenTestPrep() {
    if (isPremium) onOpenTestPrep()
    else setShowPremiumModal(true)
  }
  function handleOpenStudyGuide() {
    if (isPremium) onOpenStudyGuide()
    else setShowPremiumModal(true)
  }

  async function handleCancelPlan() {
    await onCancelPlan()
    setShowCancelModal(false)
  }

  const todaysEntry = [...progress.history].reverse().find((h) => h.date === today && h.subjectId === subject.id)

  // The scored first attempt for today, whether it happened this session or
  // was loaded from history on a page reload.
  const firstAttempt =
    justAnswered ??
    (todaysEntry
      ? {
          selectedIndex: todaysEntry.selectedIndex,
          correct: todaysEntry.correct,
          coinsEarned: todaysEntry.coinsEarned,
          xpEarned: todaysEntry.xpEarned,
        }
      : null)
  const firstAttemptMade = Boolean(firstAttempt)
  const firstAttemptWrong = firstAttemptMade && !firstAttempt.correct
  const solvedByRetry = Boolean(retryAttempt?.correct)
  const canRetry = firstAttemptWrong && !solvedByRetry
  const locked = firstAttemptMade && (firstAttempt.correct || solvedByRetry)

  // The most recent retry pick takes over the display once one exists;
  // otherwise fall back to the scored first attempt.
  const activeAttempt = retryAttempt ?? firstAttempt
  const displaySelectedIndex = activeAttempt?.selectedIndex ?? null
  const coinsEarnedDisplay = firstAttempt?.coinsEarned ?? 0
  const xpEarnedDisplay = firstAttempt?.xpEarned ?? 0

  const displayStreak = getEffectiveStreak(progress, today)
  const subjectsLeftToday = TOTAL_SUBJECTS - countCorrectSubjectsToday(progress.history, today)

  async function handleSelect(index) {
    if (submitting) return

    if (firstAttemptMade) {
      // Retry path: local feedback only, never touches Supabase, coins, XP, or streak.
      if (!canRetry) return
      setRetryAttempt({ selectedIndex: index, correct: index === question.correctIndex })
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await submitAnswer(progress, question, index, subject.id, today)
      onProgressChange(result.progress)
      setJustAnswered({
        selectedIndex: index,
        correct: result.correct,
        coinsEarned: result.coinsEarned,
        xpEarned: result.xpEarned,
      })
      if (result.milestoneHit) {
        setMilestone({ streak: result.milestoneHit, bonus: result.bonusEarned })
      }
      if (result.perfectWeek) {
        setPerfectWeekBonus(result.perfectWeek.bonusCents / 100)
      }
    } catch {
      setSubmitError("Couldn't save your answer. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // The already-answered entry for the browsed past date, if any — read-only
  // once it exists, no re-answering.
  const dateEntry = !isToday ? progress.history.find((h) => h.date === date && h.subjectId === subject.id) : null

  async function handlePastSelect(index) {
    if (pastSubmitting) return
    setPastSelectedIndex(index)
    setPastSubmitting(true)
    setPastSubmitError('')
    try {
      const result = await submitLateAnswer({ subject: subject.id, selectedIndex: index, date })
      onLateAnswered(result.entry)
      setAnsweringPast(false)
    } catch (err) {
      setPastSubmitError(err.message || "Couldn't save your answer. Please try again.")
      setPastSelectedIndex(null)
    } finally {
      setPastSubmitting(false)
    }
  }

  return (
    <div className="screen student-screen">
      <TopBar
        title={`${subject.icon} ${subject.name} — ${formatLongDate(date)}`}
        subtitle={`Grade ${activeQuestion.grade} • ${activeQuestion.topic}`}
        username={user.username}
        onLogout={onLogout}
        onBack={onBack}
        onLogoClick={onLogoClick}
      />

      <div className="stats-row">
        <StreakFlame streak={displayStreak} />
        <StatPill icon="⚡" label="XP" value={progress.xp} />
        <StatPill icon="🪙" label="Coins" value={progress.coins} />
      </div>

      {isToday ? (
        <>
          <div className={`daily-status-banner ${firstAttemptMade ? 'daily-status-banner--done' : 'daily-status-banner--pending'}`}>
            {firstAttemptMade ? "✅ Today's question answered" : "🕐 Today's question not answered yet"}
          </div>

          <QuestionCard
            question={question}
            answered={displaySelectedIndex !== null}
            locked={locked}
            selectedIndex={displaySelectedIndex}
            celebrate={Boolean(justAnswered?.correct)}
            onSelect={handleSelect}
          />

          {submitError && <p className="form-error">{submitError}</p>}

          {firstAttemptMade && (
            <div
              className={`result-banner ${
                firstAttempt.correct
                  ? 'result-banner--correct'
                  : solvedByRetry
                    ? 'result-banner--neutral'
                    : 'result-banner--wrong'
              }`}
            >
              {firstAttempt.correct ? (
                <>
                  <p className="result-headline">
                    Correct! +{coinsEarnedDisplay} coins · +{xpEarnedDisplay} XP
                  </p>
                  <p className="result-next">
                    {subjectsLeftToday === 0
                      ? '✅ All 6 done for today!'
                      : `🔥 Streak saved for today! ${subjectsLeftToday} more subject${subjectsLeftToday === 1 ? '' : 's'} left for extra XP and coins.`}
                  </p>
                </>
              ) : solvedByRetry ? (
                <>
                  <p className="result-headline">Nice — that's the right answer.</p>
                  <p className="result-next">Retries don't earn coins, XP, or streak credit. New question tomorrow.</p>
                </>
              ) : (
                <p className="result-headline">No coins earned — try again to learn the answer.</p>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className={`daily-status-banner ${dateEntry ? 'daily-status-banner--done' : 'daily-status-banner--pending'}`}>
            {dateEntry ? '✅ Answered' : '🕐 Not answered yet'}
          </div>

          {dateEntry ? (
            <QuestionCard
              question={pastQuestion}
              answered
              locked
              selectedIndex={dateEntry.selectedIndex}
              celebrate={false}
              onSelect={() => {}}
            />
          ) : answeringPast ? (
            <>
              <p className="late-answer-notice">Late answer — earns XP only, does not count toward streak.</p>
              <QuestionCard
                question={pastQuestion}
                answered={pastSelectedIndex !== null}
                locked={pastSubmitting || pastSelectedIndex !== null}
                selectedIndex={pastSelectedIndex}
                celebrate={false}
                onSelect={handlePastSelect}
              />
              {pastSubmitError && <p className="form-error">{pastSubmitError}</p>}
            </>
          ) : (
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setAnsweringPast(true)}>
              Answer now
            </button>
          )}
        </>
      )}

      {planForThisSubject && (
        <div className="testprep-home-card">
          <button type="button" className="testprep-home-card-main" onClick={onOpenStudyPlan}>
            <div className="testprep-home-card-text">
              <p className="testprep-home-card-title">
                🎯 {countdownLabel(subject.name, planForThisSubject.test_date)}
              </p>
              <p className="testprep-home-card-detail">
                {planForThisSubject.topic} · {computeReadiness(planForThisSubject.plan_data)}% ready
              </p>
              <div className="weekly-progress-bar">
                <div
                  className="weekly-progress-fill"
                  style={{ width: `${computeReadiness(planForThisSubject.plan_data)}%` }}
                />
              </div>
            </div>
            <span className="history-chevron">›</span>
          </button>
          <div className="testprep-home-card-actions">
            <button type="button" className="testprep-icon-btn testprep-icon-btn--done" onClick={onMarkDonePlan}>
              ✅ Mark as Done
            </button>
            <button
              type="button"
              className="testprep-icon-btn testprep-icon-btn--cancel"
              onClick={() => setShowCancelModal(true)}
              aria-label="Cancel test plan"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="home-actions">
        <button type="button" className="btn btn-secondary btn-small" onClick={handleOpenTestPrep}>
          📝 Test Prep
        </button>
        {!planForThisSubject && (
          <button type="button" className="btn btn-secondary btn-small" onClick={handleOpenStudyGuide}>
            📚 Study Guide
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-small" onClick={onOpenUpload}>
          ⬆️ Upload
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={onOpenMyUploads}>
          📁 My Uploads
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={onOpenPractice}>
          🎯 Practice
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={onOpenGrades}>
          📊 My Grades
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={onOpenCurriculum}>
          📖 Curriculum
        </button>
      </div>

      <MilestoneModal milestone={milestone} onClose={() => setMilestone(null)} />
      {perfectWeekBonus !== null && (
        <PerfectWeekCelebration amount={perfectWeekBonus} onClose={() => setPerfectWeekBonus(null)} />
      )}
      {showPremiumModal && <GoPremiumModal onClose={() => setShowPremiumModal(false)} />}
      {showCancelModal && planForThisSubject && (
        <CancelTestPlanModal onConfirm={handleCancelPlan} onClose={() => setShowCancelModal(false)} />
      )}
    </div>
  )
}
