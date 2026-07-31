import { useEffect, useMemo, useState } from 'react'
import {
  getProgress,
  getDailyProgress,
  getPendingFriendRequests,
  respondToFriendRequest,
  getActiveStudyPlan,
  completeStudyPlan,
  cancelStudyPlan,
  getIncomingShares,
  markShareSeen,
  getNotifications,
  resendVerificationEmail,
} from '../../lib/storage'
import { getSubject } from '../../lib/questions'
import { getEffectiveStreak, todayStr, addDaysStr, formatLongDate, computeDayState, LAUNCH_DATE } from '../../lib/streak'
import { getUserTimeZone } from '../../lib/timezone'
import { isPushSupported, subscribeToPush } from '../../lib/push'
import TopBar from '../shared/TopBar'
import SubjectDashboard from './SubjectDashboard'
import StudentHome from './StudentHome'
import CalendarScreen from './CalendarScreen'
import Leaderboard from '../shared/Leaderboard'
import SettingsScreen from '../shared/SettingsScreen'
import ShareStreakScreen from './share/ShareStreakScreen'
import FriendScoreCardModal from './share/FriendScoreCardModal'
import StreakFlame from './StreakFlame'
import StatPill from './StatPill'
import InfoModal from './InfoModal'
import FriendsScreen from './friends/FriendsScreen'
import FriendRequestBanner from './friends/FriendRequestBanner'
import NotificationsScreen from './notifications/NotificationsScreen'
import TestPrepSetupScreen from './testprep/TestPrepSetupScreen'
import StudyPlanScreen from './testprep/StudyPlanScreen'
import StudyGuideScreen from './testprep/StudyGuideScreen'
import UploadsFlow from './uploads/UploadsFlow'
import PracticeFlow from './practice/PracticeFlow'
import GradesScreen from './grades/GradesScreen'
import CurriculumOutlineScreen from './curriculum/CurriculumOutlineScreen'

// Push-permission banner dismissal cooldown — see showPushBanner below.
// localStorage (not the server) is the right place for this: permission
// state is inherently per-device/per-browser, not per-account, so a
// server-side "dismissed" flag would incorrectly suppress the prompt on a
// different device that's never actually been asked.
const PUSH_BANNER_DISMISS_KEY = 'zyndal_push_banner_dismissed_at'
const PUSH_BANNER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

// Explanations shown by the "?" info badges on the home screen's stats and
// action buttons — keyed to match the setInfoModalKey() calls below.
const INFO_CONTENT = {
  streak: {
    icon: '🔥',
    title: 'Day Streak',
    text: "Your streak counts how many days in a row you've answered at least one question correctly. Go a full day without a single correct answer and it resets to zero. Keep it alive to earn bonus coins at 7, 14 and 30 days!",
  },
  xp: {
    icon: '⚡',
    title: 'XP',
    text: "XP (Experience Points) are your permanent score. They never reset and show how much you've learned. Climb the leaderboard by earning more XP than your friends.",
  },
  coins: {
    icon: '🪙',
    title: 'Coins',
    text: 'Coins are your earnings. You earn coins for every correct first attempt. Your parent can convert coins into real money — ask them to set up your reward wallet!',
  },
  leaderboard: {
    icon: '🏆',
    title: 'Leaderboard',
    text: 'The leaderboard ranks all Zyndal students by XP. See how you stack up against friends and students across Canada. A Friends tab shows only your added friends.',
  },
}

export default function StudentFlow({ user, onLogout, onUserUpdate }) {
  // The browser's own zone, not UTC — see src/lib/timezone.js. Used for
  // every local derivation from the already-loaded progress object
  // (streak flame, streak-risk banner); the subject grid's own done/wrong
  // state comes from dailyProgress below instead, computed server-side in
  // this same zone (see api/student/get-daily-progress.js).
  const today = todayStr(new Date(), getUserTimeZone())
  const [progress, setProgress] = useState(null)
  const [dailyProgress, setDailyProgress] = useState(null)
  const [pickedSubjectId, setPickedSubjectId] = useState(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [infoModalKey, setInfoModalKey] = useState(null)
  const [showShareScreen, setShowShareScreen] = useState(false)
  const [showFriends, setShowFriends] = useState(false)
  const [pendingFriendRequests, setPendingFriendRequests] = useState(null)
  const [activePlan, setActivePlan] = useState(null)
  const [showTestPrepSetup, setShowTestPrepSetup] = useState(false)
  const [showStudyPlan, setShowStudyPlan] = useState(false)
  const [showStudyGuide, setShowStudyGuide] = useState(false)
  const [uploadsView, setUploadsView] = useState(null) // null | 'select-type' | 'library'
  const [showPractice, setShowPractice] = useState(false)
  const [showGrades, setShowGrades] = useState(false)
  const [showCurriculum, setShowCurriculum] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  // Shares received today that the student hasn't marked seen yet — powers
  // the home-screen notification box (below). Friends screen fetches its
  // own independent copy for its badge (see FriendsScreen.jsx) rather than
  // sharing this state, matching this codebase's existing per-screen-fetch
  // convention (it already re-fetches friends/pendingRequests/shares itself
  // instead of receiving StudentFlow's own copies).
  const [incomingShares, setIncomingShares] = useState([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  // The share currently shown in the read-only friend-score-card modal,
  // opened from the home-screen notification box below.
  const [viewingShare, setViewingShare] = useState(null)
  // The date the home screen's subject grid and score box are showing —
  // defaults to today, steps via the date-nav bar's arrows, or jumps
  // straight to a tapped day in CalendarScreen. Persists across opening and
  // closing a subject screen so "back" returns to the same browsed date.
  const [selectedDate, setSelectedDate] = useState(today)

  // user.linked_parent_deleted comes from login/get-profile (see
  // api/_lib/db.js's isLinkedParentDeleted) — shown once per mount, then
  // auto-dismisses on its own after 5s (still manually closeable sooner).
  const [showParentDeletedBanner, setShowParentDeletedBanner] = useState(Boolean(user.linked_parent_deleted))
  useEffect(() => {
    if (!user.linked_parent_deleted) return
    const timer = setTimeout(() => setShowParentDeletedBanner(false), 5000)
    return () => clearTimeout(timer)
  }, [user.linked_parent_deleted])

  // Shown once per mount, dismissed only by the ✕ (no auto-dismiss timer,
  // unlike the parent-deleted banner above) — only seeded true when there's
  // an actual unverified email; an account with no email at all shouldn't
  // be nagged to verify one it never set.
  const [showVerifyBanner, setShowVerifyBanner] = useState(Boolean(user.email && !user.email_verified))
  const [resendState, setResendState] = useState('idle') // idle | sending | sent | error
  const [resendError, setResendError] = useState('')

  async function handleResendVerification() {
    if (resendState === 'sending') return
    setResendState('sending')
    setResendError('')
    try {
      await resendVerificationEmail()
      setResendState('sent')
    } catch (err) {
      setResendState('error')
      setResendError(err.message || "Couldn't send the email. Please try again.")
    }
  }

  // Shown once per session while the browser hasn't been asked yet
  // (Notification.permission === 'default' is the actual source of truth
  // here, not new server state) and no "Not now" dismissal is still
  // within its 7-day cooldown.
  const [showPushBanner, setShowPushBanner] = useState(() => {
    if (!isPushSupported() || typeof Notification === 'undefined' || Notification.permission !== 'default') return false
    try {
      const dismissedAt = Number(localStorage.getItem(PUSH_BANNER_DISMISS_KEY) || 0)
      if (Date.now() - dismissedAt < PUSH_BANNER_COOLDOWN_MS) return false
    } catch {
      // localStorage inaccessible (e.g. private browsing) — fall through to showing it.
    }
    return true
  })
  const [pushRequesting, setPushRequesting] = useState(false)

  async function handleAllowPush() {
    if (pushRequesting) return
    setPushRequesting(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') await subscribeToPush()
    } catch (err) {
      console.error('[push] permission request failed:', err)
    } finally {
      setPushRequesting(false)
      setShowPushBanner(false)
    }
  }

  function handleDismissPushBanner() {
    try {
      localStorage.setItem(PUSH_BANNER_DISMISS_KEY, String(Date.now()))
    } catch {
      // ignore — worst case the banner just reappears next session
    }
    setShowPushBanner(false)
  }

  // The logo always resets to this subject-selection home view for a logged-in
  // student — StudentHome/AnswerDetail unmount as a side effect of clearing
  // pickedSubjectId, so their own local state doesn't need separate resetting.
  function handleLogoClick() {
    setShowLeaderboard(false)
    setShowSettings(false)
    setShowShareScreen(false)
    setShowFriends(false)
    setShowTestPrepSetup(false)
    setShowStudyPlan(false)
    setShowStudyGuide(false)
    setUploadsView(null)
    setShowPractice(false)
    setShowGrades(false)
    setShowCurriculum(false)
    setShowCalendar(false)
    setShowNotifications(false)
    setSelectedDate(today)
    setPickedSubjectId(null)
  }

  async function handleMarkDone() {
    await completeStudyPlan(activePlan.id)
    setActivePlan(null)
  }

  async function handleCancelPlan() {
    await cancelStudyPlan(activePlan.id)
    setActivePlan(null)
  }

  useEffect(() => {
    let cancelled = false
    getProgress(user.id).then((p) => {
      if (!cancelled) setProgress(p)
      // Best-effort cache so the offline fallback page (public/offline.html)
      // can still show a streak count with no network or app bundle loaded.
      try {
        localStorage.setItem('zyndal_last_streak', String(getEffectiveStreak(p, todayStr(new Date(), getUserTimeZone()))))
      } catch {
        // Ignore — offline page just won't show a streak number.
      }
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  useEffect(() => {
    let cancelled = false
    getDailyProgress().then((d) => {
      if (!cancelled) setDailyProgress(d)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  // StudentHome.jsx calls this via onProgressChange right after a real
  // (server-scored) answer submission — re-fetching here keeps the subject
  // grid's done/incorrect state in sync with that answer without trusting a
  // client-side guess at what just changed.
  function handleProgressChange(newProgress) {
    setProgress(newProgress)
    getDailyProgress().then(setDailyProgress)
  }

  // StudentHome.jsx calls this after a past-date "Answer now" catch-up
  // answer — api/student/submit-late-answer.js already enforced
  // XP-only/no-streak server-side, so this just appends the entry and adds
  // its XP locally, matching that exactly. Never touches coins/streak/
  // dailyProgress: a past day's answer was never "today" and shouldn't move
  // any of those.
  function handleLateAnswered(entry) {
    setProgress((prev) => ({
      ...prev,
      xp: prev.xp + entry.xpEarned,
      history: [...prev.history, entry],
    }))
  }

  useEffect(() => {
    let cancelled = false
    getPendingFriendRequests(user.id).then((list) => {
      if (!cancelled) setPendingFriendRequests(list)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  // Refreshes incomingShares/unreadNotificationCount — called on mount and
  // again whenever the Friends or Notifications screens are closed, since
  // this component's own mount effects don't re-run on a screen toggle and
  // a share/notification could have been marked seen/read while one of
  // those screens was open.
  async function refreshNotificationState() {
    const [incoming, { unreadCount }] = await Promise.all([getIncomingShares(), getNotifications()])
    setIncomingShares(incoming)
    setUnreadNotificationCount(unreadCount)
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([getIncomingShares(), getNotifications()]).then(([incoming, { unreadCount }]) => {
      if (cancelled) return
      setIncomingShares(incoming)
      setUnreadNotificationCount(unreadCount)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  async function handleViewShare(share) {
    setIncomingShares((prev) => prev.filter((s) => s.id !== share.id))
    setViewingShare(share)
    try {
      await markShareSeen(share.id)
    } catch (err) {
      console.error('[StudentFlow] failed to mark share seen:', err)
    }
  }

  useEffect(() => {
    if (!user.is_premium) return
    let cancelled = false
    getActiveStudyPlan(user.id).then((plan) => {
      if (!cancelled) setActivePlan(plan)
    })
    return () => {
      cancelled = true
    }
  }, [user.id, user.is_premium])

  async function handleRespondToFriendRequest(requestId, accept) {
    await respondToFriendRequest(requestId, accept)
    const list = await getPendingFriendRequests(user.id)
    setPendingFriendRequests(list)
  }

  const isViewingToday = selectedDate === today

  // Today's grid state is sourced from dailyProgress (api/student/get-daily-
  // progress.js), not derived from progress.history locally — see
  // handleProgressChange above for why the grid trusts the server's own
  // local-timezone "today" rather than recomputing it client-side. A past
  // date has no such ambiguity (it's already a fixed, resolved day), so it's
  // computed client-side from the already-fully-loaded progress.history via
  // the same logic get-daily-progress.js uses server-side for today.
  const todayCompletedIds = useMemo(() => new Set(dailyProgress?.completed_subjects ?? []), [dailyProgress])
  const todayIncorrectIds = useMemo(() => new Set(dailyProgress?.incorrect_subjects ?? []), [dailyProgress])
  const pastDayState = useMemo(
    () => (isViewingToday || !progress ? null : computeDayState(progress.history, selectedDate)),
    [isViewingToday, progress, selectedDate]
  )
  const completedSubjectIds = isViewingToday ? todayCompletedIds : (pastDayState?.completedIds ?? new Set())
  const incorrectSubjectIds = isViewingToday ? todayIncorrectIds : (pastDayState?.incorrectIds ?? new Set())

  // Only worth warning about if there's an actual streak in progress to
  // lose, the student hasn't gotten a single correct answer yet today (one
  // is now all it takes to keep the streak — see applyDailyAnswer), and
  // it's after 8pm local time so it doesn't nag all day.
  const showStreakRiskWarning =
    Boolean(progress) &&
    Boolean(dailyProgress) &&
    getEffectiveStreak(progress, today) > 0 &&
    dailyProgress.total_completed === 0 &&
    new Date().getHours() >= 20

  const activeSubject = useMemo(() => (pickedSubjectId ? getSubject(pickedSubjectId) : null), [pickedSubjectId])
  const greetingName = user.display_name || user.username
  const avatarPrefix = user.avatar ? `${user.avatar} ` : ''

  if (!progress) {
    return (
      <div className="screen student-screen">
        <TopBar
          title={`${avatarPrefix}Hey, ${greetingName} 👋`}
          subtitle="Choose today's subject"
          username={user.username}
          onLogout={onLogout}
          onLogoClick={handleLogoClick}
        />
        <p className="loading-text">Loading your progress…</p>
      </div>
    )
  }

  if (showLeaderboard) {
    return (
      <Leaderboard
        highlightUserIds={new Set([user.id])}
        username={user.username}
        currentUserId={user.id}
        onBack={() => setShowLeaderboard(false)}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showSettings) {
    return (
      <SettingsScreen
        user={user}
        onBack={() => setShowSettings(false)}
        onLogout={onLogout}
        onSaved={onUserUpdate}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showFriends) {
    return (
      <FriendsScreen
        user={user}
        onBack={() => {
          setShowFriends(false)
          refreshNotificationState()
        }}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showNotifications) {
    return (
      <NotificationsScreen
        user={user}
        onBack={() => {
          setShowNotifications(false)
          refreshNotificationState()
        }}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showShareScreen) {
    return (
      <ShareStreakScreen
        user={user}
        streak={getEffectiveStreak(progress, today)}
        xp={progress.xp}
        todayScore={dailyProgress?.total_completed ?? 0}
        subjectsAttemptedToday={(dailyProgress?.completed_subjects?.length ?? 0) + (dailyProgress?.incorrect_subjects?.length ?? 0)}
        today={today}
        onBack={() => setShowShareScreen(false)}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showTestPrepSetup) {
    return (
      <TestPrepSetupScreen
        user={user}
        lockedSubjectId={pickedSubjectId}
        onPlanCreated={(plan) => {
          setActivePlan(plan)
          setShowTestPrepSetup(false)
          setShowStudyPlan(true)
        }}
        onBack={() => setShowTestPrepSetup(false)}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showStudyPlan && activePlan) {
    return (
      <StudyPlanScreen
        user={user}
        plan={activePlan}
        onPlanUpdate={setActivePlan}
        onBack={() => setShowStudyPlan(false)}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showStudyGuide) {
    return (
      <StudyGuideScreen
        user={user}
        subject={activeSubject}
        onBack={() => setShowStudyGuide(false)}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (uploadsView) {
    return (
      <UploadsFlow
        user={user}
        initialView={uploadsView}
        lockedSubjectId={pickedSubjectId}
        onExit={() => setUploadsView(null)}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showPractice) {
    return (
      <PracticeFlow
        user={user}
        lockedSubjectId={pickedSubjectId}
        onExit={() => setShowPractice(false)}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showGrades) {
    return (
      <GradesScreen
        user={user}
        lockedSubjectId={pickedSubjectId}
        onBack={() => setShowGrades(false)}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showCurriculum && activeSubject) {
    return (
      <CurriculumOutlineScreen
        user={user}
        subject={activeSubject}
        onBack={() => setShowCurriculum(false)}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showCalendar) {
    return (
      <CalendarScreen
        user={user}
        progress={progress}
        today={today}
        onSelectDay={(d) => {
          setSelectedDate(d)
          setShowCalendar(false)
        }}
        onBack={() => setShowCalendar(false)}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (!activeSubject) {
    return (
      <div className="screen student-screen">
        <TopBar
          title={`${avatarPrefix}Hey, ${greetingName} 👋`}
          subtitle="Choose today's subject"
          username={user.username}
          onLogout={onLogout}
          onNotifications={() => setShowNotifications(true)}
          unreadCount={unreadNotificationCount}
          onSettings={() => setShowSettings(true)}
          onLogoClick={handleLogoClick}
        />

        {showParentDeletedBanner && (
          <div className="parent-deleted-banner">
            <span>Your parent account was deactivated. Ask a parent to create a new account and re-link.</span>
            <button
              type="button"
              className="parent-deleted-banner-close"
              onClick={() => setShowParentDeletedBanner(false)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {showVerifyBanner && (
          <div className="verify-email-banner">
            <span>
              📧 Please verify your email — check your inbox.{' '}
              {resendState === 'sent' ? (
                'Sent!'
              ) : (
                <button type="button" className="verify-email-banner-resend" onClick={handleResendVerification} disabled={resendState === 'sending'}>
                  {resendState === 'sending' ? 'Sending…' : 'Resend email'}
                </button>
              )}
              {resendState === 'error' && <span className="verify-email-banner-error"> {resendError}</span>}
            </span>
            <button
              type="button"
              className="verify-email-banner-close"
              onClick={() => setShowVerifyBanner(false)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {showPushBanner && (
          <div className="verify-email-banner">
            <span>Stay in the loop — allow Zyndal to notify you when friends share their score</span>
            <button type="button" className="verify-email-banner-resend" onClick={handleAllowPush} disabled={pushRequesting}>
              {pushRequesting ? 'Requesting…' : 'Allow notifications'}
            </button>
            <button type="button" className="auth-link-btn" onClick={handleDismissPushBanner}>
              Not now
            </button>
            <button
              type="button"
              className="verify-email-banner-close"
              onClick={handleDismissPushBanner}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        <div className="stats-row">
          <StreakFlame streak={getEffectiveStreak(progress, today)} onInfoClick={() => setInfoModalKey('streak')} />
          <StatPill icon="⚡" label="XP" value={progress.xp} onInfoClick={() => setInfoModalKey('xp')} />
          <StatPill icon="🪙" label="Coins" value={progress.coins} onInfoClick={() => setInfoModalKey('coins')} />
        </div>

        {pendingFriendRequests && pendingFriendRequests.length > 0 && (
          <div className="friend-request-banner-list">
            {pendingFriendRequests.map((request) => (
              <FriendRequestBanner key={request.id} request={request} onRespond={handleRespondToFriendRequest} />
            ))}
          </div>
        )}

        {incomingShares.length > 0 && (
          <div className="friend-request-banner-list">
            {incomingShares.map((share) => (
              <div key={share.id} className="incoming-share-banner">
                <p className="incoming-share-text">
                  🔥 <strong>@{share.senderUsername}</strong> shared their daily score with you!
                </p>
                <button type="button" className="btn btn-primary btn-small" onClick={() => handleViewShare(share)}>
                  View Score
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="home-actions">
          <div className="home-action-wrap">
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowLeaderboard(true)}>
              🏆 Leaderboard
            </button>
            <button
              type="button"
              className="info-badge"
              onClick={() => setInfoModalKey('leaderboard')}
              aria-label="What is the leaderboard?"
            >
              i
            </button>
          </div>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowFriends(true)}>
            👥 Friends
          </button>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowCalendar(true)}>
            📅 Calendar
          </button>
        </div>

        <div className="calendar-nav">
          <button
            type="button"
            className="calendar-nav-arrow"
            onClick={() => setSelectedDate(addDaysStr(selectedDate, -1))}
            disabled={selectedDate <= LAUNCH_DATE}
            aria-label="Previous day"
          >
            ←
          </button>
          <span className="calendar-nav-label">{formatLongDate(selectedDate)}</span>
          <button
            type="button"
            className="calendar-nav-arrow"
            onClick={() => setSelectedDate(addDaysStr(selectedDate, 1))}
            disabled={selectedDate >= today}
            aria-label="Next day"
          >
            →
          </button>
        </div>

        {showStreakRiskWarning && (
          <div className="streak-risk-banner">
            ⚠️ Your streak expires at midnight — answer at least one question correctly to keep it alive!
          </div>
        )}

        <SubjectDashboard
          completedSubjectIds={completedSubjectIds}
          incorrectSubjectIds={incorrectSubjectIds}
          onSelectSubject={setPickedSubjectId}
          onShareClick={() => setShowShareScreen(true)}
          date={selectedDate}
          isToday={isViewingToday}
        />

        {infoModalKey && (
          <InfoModal
            icon={INFO_CONTENT[infoModalKey].icon}
            title={INFO_CONTENT[infoModalKey].title}
            text={INFO_CONTENT[infoModalKey].text}
            onClose={() => setInfoModalKey(null)}
          />
        )}

        {viewingShare && <FriendScoreCardModal share={viewingShare} onClose={() => setViewingShare(null)} />}
      </div>
    )
  }

  return (
    <StudentHome
      user={user}
      subject={activeSubject}
      progress={progress}
      onProgressChange={handleProgressChange}
      date={selectedDate}
      onLateAnswered={handleLateAnswered}
      activePlan={activePlan}
      isPremium={user.is_premium}
      onOpenTestPrep={() => setShowTestPrepSetup(true)}
      onOpenStudyGuide={() => setShowStudyGuide(true)}
      onOpenStudyPlan={() => setShowStudyPlan(true)}
      onMarkDonePlan={handleMarkDone}
      onCancelPlan={handleCancelPlan}
      onOpenUpload={() => setUploadsView('select-type')}
      onOpenMyUploads={() => setUploadsView('library')}
      onOpenPractice={() => setShowPractice(true)}
      onOpenGrades={() => setShowGrades(true)}
      onOpenCurriculum={() => setShowCurriculum(true)}
      onBack={() => setPickedSubjectId(null)}
      onLogout={onLogout}
      onLogoClick={handleLogoClick}
    />
  )
}
