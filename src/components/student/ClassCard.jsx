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
  groupId,
  joined,
  onJoin,
  claimedClasses,
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
  const [joining, setJoining] = useState(false)

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
          below are usable either way, exactly as before this feature. */}
      {!joined && (
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
      </div>

      {/* One row per forum this student can actually access for this
          subject — the open group's own forum (once joined) plus one row
          per already-joined claimed class (claimedClasses is already
          filtered to classes this student belongs to — see
          api/student/get-school-subject-groups.js), since a subject tile
          can have both at once. Omitted entirely if there's nothing to
          show yet (not joined, no claimed classes). */}
      {(joined || (claimedClasses && claimedClasses.length > 0)) && (
        <div className="forum-section">
          <h3 className="section-heading">{t('classCard.forumSectionHeading')}</h3>
          <div className="forum-entry-list">
            {joined && (
              <button
                type="button"
                className="forum-entry-row"
                onClick={() => onOpenForum({ classType: 'group', classId: groupId, className: t('classCard.forumOpenGroup', { subject: t(`subjects.${subject.id}`) }) })}
              >
                {t('classCard.forumOpenGroup', { subject: t(`subjects.${subject.id}`) })}
              </button>
            )}
            {claimedClasses?.map((c) => (
              <button
                key={c.id}
                type="button"
                className="forum-entry-row"
                onClick={() => onOpenForum({ classType: 'class', classId: c.id, className: c.name })}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
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

      {/* Claim status — once the student has joined one of this group's
          claimed classes (existing join-by-code flow, unrelated to the Join
          Group button above), its name ("Math 416 Mr. Smith", already
          formatted this way at approval time — see resolve-teacher-claim.js)
          replaces the plain unclaimed "Gr 9 St. Thomas" text. */}
      <p className="class-card-status">
        {claimedClasses && claimedClasses.length > 0
          ? claimedClasses.map((c) => c.name).join(' · ')
          : t('classCard.unclaimedStatus', { grade, school: schoolName })}
      </p>

      {showPremiumModal && <UpgradeModal user={user} onClose={() => setShowPremiumModal(false)} />}
      {showCancelModal && planForThisSubject && (
        <CancelTestPlanModal onConfirm={handleCancelPlan} onClose={() => setShowCancelModal(false)} />
      )}
    </div>
  )
}
