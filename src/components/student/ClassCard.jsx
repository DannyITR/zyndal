import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getEffectiveStreak, todayStr } from '../../lib/streak'
import { getUserTimeZone } from '../../lib/timezone'
import { countdownLabel, computeReadiness } from '../../lib/testprep'
import TopBar from '../shared/TopBar'
import StreakFlame from './StreakFlame'
import StatPill from './StatPill'
import UpgradeModal from '../shared/UpgradeModal'
import PremiumFeatureButton from '../shared/PremiumFeatureButton'
import CancelTestPlanModal from './testprep/CancelTestPlanModal'
import LeaveClassModal from './LeaveClassModal'
import HomeworkCalendar from './classes/HomeworkCalendar'
import HomeworkDetailScreen from './classes/HomeworkDetailScreen'
import ForumThreadPreview from '../shared/forum/ForumThreadPreview'

// The full per-class page — Test Prep, Study Guide, Upload, My Uploads,
// Practice, My Grades, Curriculum, and the active-test-plan card, carried
// over from StudentHome.jsx (the daily-question page), which commented all
// of this out when it was simplified down to just the daily question. This
// is that "upcoming class-card work" — everything here is unchanged from
// that original design, just without the daily question itself, which stays
// on its own separate rotating "Today's Question" card/page.
export default function ClassCard({
  user,
  subject,
  progress,
  activePlan,
  isPremium,
  grade,
  schoolName,
  entryKind, // 'group' | 'class' — which single class this card represents
  entryId, // the group's or class's own id
  entryName, // the claimed class's display name ('class' entries only)
  currentUnitNumber, // 'class' entries only — classes.current_unit_number
  currentUnitTitle, // 'class' entries only — classes.current_unit_title
  classCreatedAt, // 'class' entries only — bounds the homework calendar's earliest month
  joined, // 'group' entries only — a 'class' entry is always joined
  onJoin,
  onLeave,
  onStartHomework, // 'class' entries only — (assignmentId) => boolean, see StudentFlow.jsx
  onOpenForum,
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
  const { t } = useTranslation()
  const today = todayStr(new Date(), getUserTimeZone())
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [joining, setJoining] = useState(false)
  // 'class' entries only — { date, assignments } when a calendar day is
  // selected, swapping the page to HomeworkDetailScreen internally (same
  // self-contained internal-navigation pattern as ForumScreen.jsx) instead
  // of pushing yet another top-level view into StudentFlow.jsx.
  const [dayDetail, setDayDetail] = useState(null)
  const [startError, setStartError] = useState('')

  const displayStreak = getEffectiveStreak(progress, today)
  const planForThisSubject = activePlan && activePlan.subject === subject.id ? activePlan : null

  // Test Prep, the Study Guide, Upload, My Uploads, and Practice are all
  // premium features; a trial_expired/free student sees the upgrade pitch
  // instead. isPremium is StudentFlow's isPremiumUnlocked(user) (see
  // src/lib/premium.js) — true whenever subscription_status is
  // 'trial_active' or 'premium' — deliberately NOT the raw user.is_premium
  // column, which can drift out of sync with the trial dates (e.g. an admin
  // extending trial_ends_at without also flipping is_premium back on).
  function handleOpenTestPrep() {
    if (isPremium) onOpenTestPrep()
    else setShowPremiumModal(true)
  }
  function handleOpenStudyGuide() {
    if (isPremium) onOpenStudyGuide()
    else setShowPremiumModal(true)
  }
  function handleOpenUpload() {
    if (isPremium) onOpenUpload()
    else setShowPremiumModal(true)
  }
  function handleOpenMyUploads() {
    if (isPremium) onOpenMyUploads()
    else setShowPremiumModal(true)
  }
  function handleOpenPractice() {
    if (isPremium) onOpenPractice()
    else setShowPremiumModal(true)
  }

  async function handleCancelPlan() {
    await onCancelPlan()
    setShowCancelModal(false)
  }

  async function handleJoin() {
    if (joining) return
    setJoining(true)
    try {
      await onJoin()
    } finally {
      setJoining(false)
    }
  }

  // Leaving navigates back to the home screen immediately after the
  // membership row is gone — there's nothing left on this page for the
  // student to see once they're no longer a member. LeaveClassModal itself
  // catches a thrown error and stays open, so onBack only ever runs on
  // success.
  async function handleLeave() {
    await onLeave()
    onBack()
  }

  // Shared by both the Forum button and ForumThreadPreview's compact rows
  // below, so the { classType, classId, className } target is only built
  // in one place. initialThreadId is only ever passed by the preview
  // (jumping straight to a specific thread's detail view); the plain
  // button omits it, landing on the thread list as before.
  function handleOpenForum(initialThreadId) {
    onOpenForum({
      classType: entryKind,
      classId: entryId,
      className: entryKind === 'class' ? entryName : t(`subjects.${subject.id}`),
      initialThreadId,
    })
  }

  // onStartHomework looks the assignment up in StudentFlow's already-loaded
  // homework list and hands off to its top-level activeHomework/HomeworkFlow
  // takeover — returns false if the assignment can't be found or has no
  // questions, matching the old ClassesFlow.jsx's own guard.
  function handleStartFromDetail(assignmentId) {
    setStartError('')
    const started = onStartHomework(assignmentId)
    if (!started) setStartError(t('errors.NOT_FOUND'))
  }

  if (dayDetail) {
    return (
      <>
        {startError && <p className="form-error">{startError}</p>}
        <HomeworkDetailScreen
          user={user}
          date={dayDetail.date}
          assignments={dayDetail.assignments}
          onBack={() => setDayDetail(null)}
          onLogout={onLogout}
          onLogoClick={onLogoClick}
          onStart={handleStartFromDetail}
        />
      </>
    )
  }

  return (
    <div className="screen student-screen">
      <TopBar
        title={`${subject.icon} ${t(`subjects.${subject.id}`)}`}
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

      {/* Joining is additive, not a gate — Test Prep/Study Guide/Practice/etc.
          below are usable either way, exactly as before this feature. Only
          a 'group' entry can be unjoined at all — a 'class' entry means the
          student is already enrolled/teaching it. */}
      {entryKind === 'group' && !joined && (
        <button type="button" className="btn btn-primary btn-block" onClick={handleJoin} disabled={joining}>
          {joining ? t('classCard.joining') : t('classCard.joinGroup')}
        </button>
      )}

      <div className="home-actions">
        <PremiumFeatureButton subscriptionStatus={user.subscription_status} onClick={handleOpenTestPrep}>
          {t('home.testPrep')}
        </PremiumFeatureButton>
        {!planForThisSubject && (
          <PremiumFeatureButton subscriptionStatus={user.subscription_status} onClick={handleOpenStudyGuide}>
            {t('home.studyGuide')}
          </PremiumFeatureButton>
        )}
        <PremiumFeatureButton subscriptionStatus={user.subscription_status} onClick={handleOpenUpload}>
          {t('home.upload')}
        </PremiumFeatureButton>
        <PremiumFeatureButton subscriptionStatus={user.subscription_status} onClick={handleOpenMyUploads}>
          {t('home.myUploads')}
        </PremiumFeatureButton>
        <PremiumFeatureButton subscriptionStatus={user.subscription_status} onClick={handleOpenPractice}>
          {t('home.practice')}
        </PremiumFeatureButton>
        <PremiumFeatureButton subscriptionStatus={user.subscription_status} onClick={onOpenGrades}>
          {t('home.myGrades')}
        </PremiumFeatureButton>
        <button type="button" className="btn btn-secondary btn-small" onClick={onOpenCurriculum}>
          {t('home.curriculum')}
        </button>
        {/* This card represents exactly one class (see entryKind) — its
            forum is scoped only to that class's own members, no
            subject-wide/open forum layered on top. A 'group' entry only
            gets a forum once actually joined; a 'class' entry is always
            joined. */}
        {(entryKind === 'class' || joined) && (
          <button type="button" className="btn btn-secondary btn-small" onClick={() => handleOpenForum()}>
            {t('forum.title')}
          </button>
        )}
      </div>

      {/* Homework calendar only exists for a real class — an unclaimed
          group has no homework mechanism (teachers assign it per
          classes.id). Reuses HomeworkCalendar/HomeworkDetailScreen exactly
          as they were under the old, now-removed ClassesFlow/
          ClassHomeScreen — this is that same functionality, just reached
          from this one canonical class page instead of a separate one. */}
      {entryKind === 'class' && (
        <>
          <div className="parent-code-card">
            <p className="parent-code-label">{t('classCard.currentlyStudying')}</p>
            <p className="class-home-unit">
              {t('classCard.unitLabel', { number: currentUnitNumber })}
              {currentUnitTitle ? ` — ${currentUnitTitle}` : ''}
            </p>
          </div>

          <h3 className="section-heading">{t('classCard.homeworkCalendarHeading')}</h3>
          <HomeworkCalendar
            classId={entryId}
            classCreatedAt={classCreatedAt}
            onSelectDay={(date, assignments) => setDayDetail({ date, assignments })}
          />
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

      {/* Claim status — a 'class' entry shows its own name ("Math 416 Mr.
          Smith", already formatted this way at approval time — see
          resolve-teacher-claim.js); a 'group' entry shows the plain
          unclaimed "Gr 9 St. Thomas" text. */}
      <p className="class-card-status">
        {entryKind === 'class' ? entryName : t('classCard.unclaimedStatus', { grade, school: schoolName })}
      </p>

      {/* Compact forum preview — same access rule as the Forum button above
          (a 'group' entry needs joined:true; a 'class' entry is always
          joined), since there's nothing to preview otherwise. */}
      {(entryKind === 'class' || joined) && (
        <ForumThreadPreview classType={entryKind} classId={entryId} onSelectThread={(threadId) => handleOpenForum(threadId)} />
      )}

      <div className="settings-danger-zone">
        <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setShowLeaveModal(true)}>
          {t('classCard.leaveTitle')}
        </button>
      </div>

      {showPremiumModal && <UpgradeModal user={user} onClose={() => setShowPremiumModal(false)} />}
      {showCancelModal && planForThisSubject && (
        <CancelTestPlanModal onConfirm={handleCancelPlan} onClose={() => setShowCancelModal(false)} />
      )}
      {showLeaveModal && (
        <LeaveClassModal
          classLabel={entryKind === 'class' ? entryName : t(`subjects.${subject.id}`)}
          onConfirm={handleLeave}
          onClose={() => setShowLeaveModal(false)}
        />
      )}
    </div>
  )
}
