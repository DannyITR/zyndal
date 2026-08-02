import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { submitAnswer, submitLateAnswer, getTodayQuestion, reviewWrongAnswer, logRetryCorrect } from '../../lib/storage'
import { getDailyQuestion, formatQuestionSubtitle } from '../../lib/questions'
import {
  getEffectiveStreak,
  countCorrectSubjectsToday,
  todayStr,
  diffDays,
  TOTAL_SUBJECTS,
  LATE_ANSWER_WINDOW_DAYS,
  formatLongDate,
} from '../../lib/streak'
import { getUserTimeZone } from '../../lib/timezone'
import { countdownLabel, computeReadiness } from '../../lib/testprep'
import TopBar from '../shared/TopBar'
import StreakFlame from './StreakFlame'
import StatPill from './StatPill'
import QuestionCard from './QuestionCard'
import Scratchpad from './Scratchpad'
import WorkSubmissionPanel from './WorkSubmissionPanel'
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
  onOpenCurriculumTopic,
  onBack,
  onLogout,
  onLogoClick,
}) {
  const { t } = useTranslation()
  const today = todayStr(new Date(), getUserTimeZone())
  const isToday = date === today

  // Today's question — fetched from the server rather than computed
  // locally, since resolveDailyQuestion's selection (a generated-pool hash
  // pick, or a grade-filtered hardcoded fallback) depends on server-side
  // state (the student's own grade, the generated_questions pool, this
  // month's answered questions) the client has no direct access to. null
  // while loading; only relevant when isToday.
  const [question, setQuestion] = useState(null)
  const [questionError, setQuestionError] = useState('')
  useEffect(() => {
    if (!isToday) return
    let cancelled = false
    setQuestion(null)
    setQuestionError('')
    getTodayQuestion(subject.id)
      .then((data) => {
        if (cancelled) return
        setQuestion({
          prompt: data.question,
          options: data.options,
          correctIndex: data.correct,
          grade: data.grade,
          topic: data.topic,
          unitNumber: data.unit_number,
          unitTitle: data.unit_title,
          topicTitle: data.topic_title,
          source: data.source,
          explanation: data.explanation,
        })
      })
      .catch(() => {
        if (!cancelled) setQuestionError(t('home.questionLoadError'))
      })
    return () => {
      cancelled = true
    }
    // t is a stable function for the app's lifetime (see src/lib/i18n.js) —
    // not a real dependency, and including it would re-fetch on every
    // language change for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, subject.id])
  // The scored first attempt persisted this session: { selectedIndex, correct, coinsEarned, xpEarned, answerId }
  const [justAnswered, setJustAnswered] = useState(null)
  // Scratchpad is Math-only — other subjects may be added in future.
  const scratchpadRef = useRef(null)
  const [canvasHasDrawing, setCanvasHasDrawing] = useState(false)
  const isMathSubject = subject.id === 'math'
  // Step-by-step error review for a wrong Math answer with scratchpad work
  // — see handleSelect below. Only the FINAL selection (whichever pick
  // ends up submitted) ever reaches submitAnswer, so that flow needs no
  // changes at all for this: nothing here talks to submit-answer.js until
  // a pick is truly final.
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [pendingIndex, setPendingIndex] = useState(null) // the wrong pick while its review is in flight
  const [retryInfo, setRetryInfo] = useState(null) // { feedback, onRightTrack } while a second attempt is offered
  const [usedRetry, setUsedRetry] = useState(false)
  const [noWorkHint, setNoWorkHint] = useState(false) // AI reviewed scratchpad content and found no real steps
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
  // Matches api/student/submit-late-answer.js's own server-side window
  // exactly (both import the same LATE_ANSWER_WINDOW_DAYS constant) — this
  // is purely for the pre-answer message below, not itself a reward
  // decision, so it's fine for the client to compute it for display.
  const withinLateWindow = !isToday && diffDays(today, date) <= LATE_ANSWER_WINDOW_DAYS

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
          answerId: todaysEntry.id,
        }
      : null)
  const firstAttemptMade = Boolean(firstAttempt)
  // Wordle-style: the first attempt is final, correct or not — except for
  // Math with scratchpad work, where a wrong pick can earn one AI-reviewed
  // retry (see handleSelect) before it's final.
  const locked = firstAttemptMade || submitting || reviewing
  const displaySelectedIndex = retryInfo ? null : reviewing ? pendingIndex : (firstAttempt?.selectedIndex ?? null)
  const coinsEarnedDisplay = firstAttempt?.coinsEarned ?? 0
  const xpEarnedDisplay = firstAttempt?.xpEarned ?? 0
  const correctAnswerText = question ? question.options[question.correctIndex] : ''

  const displayStreak = getEffectiveStreak(progress, today)
  const subjectsLeftToday = TOTAL_SUBJECTS - countCorrectSubjectsToday(progress.history, today)

  // The final, scored submission — only ever called once per subject/day,
  // whichever pick ends up being the student's last one. submit-answer.js
  // itself needs no awareness of the retry flow at all.
  async function finalizeAnswer(index) {
    setSubmitting(true)
    setSubmitError('')
    setPendingIndex(null)
    try {
      const result = await submitAnswer(progress, question, index, subject.id, today)
      onProgressChange(result.progress)
      setJustAnswered({
        selectedIndex: index,
        correct: result.correct,
        coinsEarned: result.coinsEarned,
        xpEarned: result.xpEarned,
        answerId: result.answerId,
      })
      setRetryInfo(null)
      if (usedRetry && result.correct && result.answerId) {
        // Best-effort — the parent-dashboard "correct after hint" label is
        // a nice-to-have, never allowed to block the answer itself.
        logRetryCorrect(result.answerId, scratchpadRef.current?.toDataURL()).catch(() => {})
      }
      if (result.milestoneHit) {
        setMilestone({ streak: result.milestoneHit, bonus: result.bonusEarned })
      }
      if (result.perfectWeek) {
        setPerfectWeekBonus(result.perfectWeek.bonusCents / 100)
      }
    } catch {
      setSubmitError(t('home.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSelect(index) {
    if (submitting || reviewing) return
    // The first attempt is final — QuestionCard already disables the
    // options once locked, but this is the authoritative guard.
    if (firstAttemptMade) return

    const isWrong = index !== question.correctIndex
    const offerReview = isMathSubject && isWrong && !usedRetry && !scratchpadRef.current?.isEmpty()

    if (!offerReview) {
      await finalizeAnswer(index)
      return
    }

    setPendingIndex(index)
    setReviewing(true)
    setReviewError('')
    try {
      const dataUrl = scratchpadRef.current.toDataURL()
      const review = await reviewWrongAnswer(dataUrl)
      setReviewing(false)
      if (review.has_work) {
        setUsedRetry(true)
        setRetryInfo({ feedback: review.feedback, onRightTrack: review.on_right_track })
        setPendingIndex(null)
      } else {
        setNoWorkHint(true)
        await finalizeAnswer(index)
      }
    } catch (err) {
      setReviewing(false)
      setReviewError(err.message || t('home.reviewErrorFallback'))
      await finalizeAnswer(index)
    }
  }

  // Scratchpad is Math-only — other subjects may be added in future.
  // Fired by WorkSubmissionPanel once api/questions/grade-work.js approves
  // the drawn work — bumps the same progress object handleSelect already
  // updates, so the stats row reflects the bonus immediately.
  function handleWorkApproved(xpEarned, coinsEarned) {
    onProgressChange({ ...progress, xp: progress.xp + xpEarned, coins: progress.coins + coinsEarned })
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
      setPastSubmitError(err.message || t('home.pastSubmitError'))
      setPastSelectedIndex(null)
    } finally {
      setPastSubmitting(false)
    }
  }

  return (
    <div className="screen student-screen">
      <TopBar
        title={`${subject.icon} ${t(`subjects.${subject.id}`)} — ${formatLongDate(date)}`}
        subtitle={activeQuestion ? formatQuestionSubtitle(activeQuestion) : t('home.loading')}
        username={user.username}
        onLogout={onLogout}
        onBack={onBack}
        onLogoClick={onLogoClick}
      />

      <div className="stats-row">
        <StreakFlame streak={displayStreak} />
        <StatPill icon="⚡" label={t('home.xp')} value={progress.xp} />
        <StatPill icon="🪙" label={t('home.coins')} value={progress.coins} />
      </div>

      {isToday ? (
        <>
          {!question && !questionError && <p className="loading-text">{t('home.loadingQuestion')}</p>}
          {questionError && <p className="form-error">{questionError}</p>}

          {question && (
            <>
              <div className={`daily-status-banner ${firstAttemptMade ? 'daily-status-banner--done' : 'daily-status-banner--pending'}`}>
                {firstAttemptMade
                  ? t('home.answered')
                  : retryInfo
                    ? t('home.secondAttempt')
                    : reviewing
                      ? t('home.reviewingWork')
                      : t('home.notAnsweredYet')}
              </div>

              {retryInfo && !firstAttemptMade && (
                <p className="result-next">
                  {retryInfo.onRightTrack
                    ? t('home.onRightTrack', { feedback: retryInfo.feedback })
                    : t('home.tryDifferentApproach', { feedback: retryInfo.feedback })}
                </p>
              )}

              <QuestionCard
                question={question}
                answered={displaySelectedIndex !== null}
                locked={locked}
                selectedIndex={displaySelectedIndex}
                celebrate={Boolean(justAnswered?.correct)}
                onSelect={handleSelect}
                onOpenCurriculumTopic={onOpenCurriculumTopic}
                scratchpadSlot={
                  isMathSubject && (!firstAttemptMade || firstAttempt.correct) ? (
                    <Scratchpad ref={scratchpadRef} disabled={submitting || reviewing} onDrawingChange={setCanvasHasDrawing} />
                  ) : null
                }
              />

              {isMathSubject && firstAttemptMade && firstAttempt.correct && firstAttempt.answerId && (
                <WorkSubmissionPanel
                  answerId={firstAttempt.answerId}
                  canvasRef={scratchpadRef}
                  canvasHasDrawing={canvasHasDrawing}
                  onApproved={handleWorkApproved}
                />
              )}
            </>
          )}

          {submitError && <p className="form-error">{submitError}</p>}
          {reviewError && <p className="form-error">{reviewError}</p>}

          {firstAttemptMade && (
            <div className={`result-banner ${firstAttempt.correct ? 'result-banner--correct' : 'result-banner--wrong'}`}>
              {firstAttempt.correct ? (
                <>
                  <p className="result-headline">
                    {t('home.correctResult', { coins: coinsEarnedDisplay, xp: xpEarnedDisplay })}
                  </p>
                  <p className="result-next">
                    {subjectsLeftToday === 0
                      ? t('home.allDoneToday')
                      : t('home.streakSaved', { count: subjectsLeftToday })}
                  </p>
                </>
              ) : (
                <>
                  <p className="result-headline">{t('home.wrongResult', { answer: correctAnswerText })}</p>
                  <p className="result-next">
                    {usedRetry
                      ? t('home.keepPracticing')
                      : noWorkHint
                        ? t('home.showWorkHint')
                        : t('home.comeBackTomorrow')}
                  </p>
                  {question?.explanation && <p className="result-explanation">{question.explanation}</p>}
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className={`daily-status-banner ${dateEntry ? 'daily-status-banner--done' : 'daily-status-banner--pending'}`}>
            {dateEntry ? t('home.pastAnswered') : t('home.pastNotAnswered')}
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
              <p className="late-answer-notice">
                {withinLateWindow ? t('home.lateAnswerFull') : t('home.lateAnswerPracticeOnly')}
              </p>
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
              {t('home.answerNow')}
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
              {t('home.markAsDone')}
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
          {t('home.testPrep')}
        </button>
        {!planForThisSubject && (
          <button type="button" className="btn btn-secondary btn-small" onClick={handleOpenStudyGuide}>
            {t('home.studyGuide')}
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-small" onClick={onOpenUpload}>
          {t('home.upload')}
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={onOpenMyUploads}>
          {t('home.myUploads')}
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={onOpenPractice}>
          {t('home.practice')}
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={onOpenGrades}>
          {t('home.myGrades')}
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={onOpenCurriculum}>
          {t('home.curriculum')}
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
