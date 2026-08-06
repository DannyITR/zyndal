import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  getMyHomework,
} from '../../lib/storage'
import { getSubject } from '../../lib/questions'
import { getEffectiveStreak, todayStr, addDaysStr, formatLongDate, computeDayState, LAUNCH_DATE, TOTAL_SUBJECTS } from '../../lib/streak'
import { getUserTimeZone } from '../../lib/timezone'
import { isPushSupported, subscribeToPush } from '../../lib/push'
import { isPremiumUnlocked } from '../../lib/premium'
import { getErrorMessage } from '../../lib/errors'
import TopBar from '../shared/TopBar'
import TrialBanner from '../shared/TrialBanner'
import UpgradeModal from '../shared/UpgradeModal'
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
import WalletScreen from './wallet/WalletScreen'
import CurriculumOutlineScreen from './curriculum/CurriculumOutlineScreen'
import HomeworkFlow from './homework/HomeworkFlow'
import ClassesFlow from './classes/ClassesFlow'

// Push-permission banner dismissal cooldown — see showPushBanner below.
// localStorage (not the server) is the right place for this: permission
// state is inherently per-device/per-browser, not per-account, so a
// server-side "dismissed" flag would incorrectly suppress the prompt on a
// different device that's never actually been asked.
const PUSH_BANNER_DISMISS_KEY = 'zyndal_push_banner_dismissed_at'
const PUSH_BANNER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

// Explanations shown by the "?" info badges on the home screen's stats and
// action buttons — keyed to match the setInfoModalKey() calls below. Built
// from t() inside the component (not a module-level const) since it needs
// the active language.
function buildInfoContent(t) {
  return {
    streak: { icon: '🔥', title: t('home.infoStreakTitle'), text: t('home.infoStreakText') },
    xp: { icon: '⚡', title: t('home.xp'), text: t('home.infoXpText') },
    coins: { icon: '🪙', title: t('home.coins'), text: t('home.infoCoinsText') },
    leaderboard: { icon: '🏆', title: t('home.infoLeaderboardTitle'), text: t('home.infoLeaderboardText') },
  }
}

export default function StudentFlow({ user, onLogout, onUserUpdate }) {
  const { t } = useTranslation()
  const infoContent = buildInfoContent(t)
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
  const [showWallet, setShowWallet] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(null) // null | 'default' | 'trial'
  const [showCurriculum, setShowCurriculum] = useState(false)
  // Set only when the curriculum screen is opened from the daily question
  // screen's "Read about this topic" box — tells CurriculumOutlineScreen
  // which unit/topic to auto-expand and scroll to. null for the plain
  // "📖 Curriculum" nav button, which opens the full reference as before.
  const [curriculumFocus, setCurriculumFocus] = useState(null)
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
  const [homework, setHomework] = useState([])
  const [activeHomework, setActiveHomework] = useState(null)
  // Which assignment ids the Notifications screen's "Open Homework" button
  // can actually act on — anything already completed has no questions left
  // to answer (see get-homework.js), so the button just wouldn't be shown.
  const openHomeworkIds = useMemo(() => new Set(homework.filter((h) => !h.completed).map((h) => h.id)), [homework])
  const [showClasses, setShowClasses] = useState(false)
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
      setResendError(getErrorMessage(err, t))
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
    setActiveHomework(null)
    setShowClasses(false)
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
  // answer — api/student/submit-late-answer.js already enforced the 3-day
  // XP/coins window and no-streak-effect server-side, so this just appends
  // the entry and adds its (possibly zero) XP/coins locally, matching that
  // exactly. Never touches streak/dailyProgress: a past day's answer was
  // never "today" and shouldn't move either.
  function handleLateAnswered(entry) {
    setProgress((prev) => ({
      ...prev,
      xp: prev.xp + entry.xpEarned,
      coins: prev.coins + entry.coinsEarned,
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

  function refreshHomework() {
    getMyHomework()
      .then((data) => setHomework(data.homework))
      .catch(() => {})
  }

  useEffect(() => {
    refreshHomework()
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
    if (!isPremiumUnlocked(user.subscription_status)) return
    let cancelled = false
    getActiveStudyPlan(user.id).then((plan) => {
      if (!cancelled) setActivePlan(plan)
    })
    return () => {
      cancelled = true
    }
  }, [user.id, user.subscription_status])

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
  // Sharing is gated on subjects ATTEMPTED today (correct or incorrect), not
  // just correct ones — matches api/social/share-score.js's own server-side
  // check exactly. Shared by both the Friends screen and the Share Daily
  // Score screen below rather than each recomputing it.
  const canShareToday = todayCompletedIds.size + todayIncorrectIds.size >= TOTAL_SUBJECTS
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
          title={`${avatarPrefix}${t('common.greeting', { name: greetingName })}`}
          subtitle={t('home.chooseSubject')}
          username={user.username}
          onLogout={onLogout}
          onLogoClick={handleLogoClick}
        />
        <p className="loading-text">{t('home.loadingProgress')}</p>
      </div>
    )
  }

  if (showLeaderboard) {
    return (
      <Leaderboard
        highlightUserIds={new Set([user.id])}
        username={user.username}
        currentUserId={user.id}
        // Same "all 6 subjects attempted today" definition as canShareToday
        // above (completed + incorrect, sourced from dailyProgress —
        // api/student/get-daily-progress.js's own server-computed today,
        // not anything recomputed/cached here) — gates the Friends tab's
        // "catch up" nudge so it doesn't nag someone who's already done for
        // the day just because a friend has more lifetime XP.
        hasCompletedToday={canShareToday}
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
        // Same "complete today's questions first" gate the Share Daily
        // Score screen's own friend picker enforces (see
        // FriendSharePickerModal.jsx) — this screen now offers the same
        // direct Share action per friend, so it needs the same rule.
        canShareToday={canShareToday}
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
        openHomeworkIds={openHomeworkIds}
        onOpenHomework={(assignmentId) => {
          const found = homework.find((h) => h.id === assignmentId)
          if (found && found.questions) {
            setShowNotifications(false)
            setActiveHomework(found)
          }
        }}
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
        canShareToday={canShareToday}
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

  if (showWallet) {
    // Reachable only via the Coins stat box, which is itself only rendered
    // when user.has_linked_parent is true — but that flag could be stale
    // mid-session (e.g. a parent unlinked after this page loaded), so the
    // real guard is server-side: api/student/get-wallet.js throws
    // NO_LINKED_PARENT if there's no link at fetch time, and
    // onNoLinkedParent below bounces back here, matching the spec's
    // "redirect back to home screen" requirement regardless of how this
    // screen was reached.
    return (
      <WalletScreen
        user={user}
        onBack={() => setShowWallet(false)}
        onNoLinkedParent={() => setShowWallet(false)}
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
        initialUnitNumber={curriculumFocus?.unitNumber}
        initialTopicTitle={curriculumFocus?.topicTitle}
        onBack={() => {
          setShowCurriculum(false)
          setCurriculumFocus(null)
        }}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showClasses) {
    return <ClassesFlow user={user} onExit={() => setShowClasses(false)} onLogout={onLogout} onLogoClick={handleLogoClick} />
  }

  if (activeHomework) {
    return (
      <HomeworkFlow
        user={user}
        assignment={activeHomework}
        onExit={() => {
          setActiveHomework(null)
          refreshHomework()
        }}
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
          title={`${avatarPrefix}${t('common.greeting', { name: greetingName })}`}
          subtitle={t('home.chooseSubject')}
          username={user.username}
          onLogout={onLogout}
          onNotifications={() => setShowNotifications(true)}
          unreadCount={unreadNotificationCount}
          onSettings={() => setShowSettings(true)}
          onLogoClick={handleLogoClick}
        />

        {showParentDeletedBanner && (
          <div className="parent-deleted-banner">
            <span>{t('home.parentDeletedBanner')}</span>
            <button
              type="button"
              className="parent-deleted-banner-close"
              onClick={() => setShowParentDeletedBanner(false)}
              aria-label={t('home.dismiss')}
            >
              ✕
            </button>
          </div>
        )}

        {showVerifyBanner && (
          <div className="verify-email-banner">
            <span>
              {t('home.verifyEmailBanner')}{' '}
              {resendState === 'sent' ? (
                t('home.sentBang')
              ) : (
                <button type="button" className="verify-email-banner-resend" onClick={handleResendVerification} disabled={resendState === 'sending'}>
                  {resendState === 'sending' ? t('common.sending') : t('home.resendEmail')}
                </button>
              )}
              {resendState === 'error' && <span className="verify-email-banner-error"> {resendError}</span>}
            </span>
            <button
              type="button"
              className="verify-email-banner-close"
              onClick={() => setShowVerifyBanner(false)}
              aria-label={t('home.dismiss')}
            >
              ✕
            </button>
          </div>
        )}

        {showPushBanner && (
          <div className="verify-email-banner">
            <span>{t('home.pushBanner')}</span>
            <button type="button" className="verify-email-banner-resend" onClick={handleAllowPush} disabled={pushRequesting}>
              {pushRequesting ? t('home.requesting') : t('home.allowNotifications')}
            </button>
            <button type="button" className="auth-link-btn" onClick={handleDismissPushBanner}>
              {t('home.notNow')}
            </button>
            <button
              type="button"
              className="verify-email-banner-close"
              onClick={handleDismissPushBanner}
              aria-label={t('home.dismiss')}
            >
              ✕
            </button>
          </div>
        )}

        <div className="stats-row">
          <StreakFlame streak={getEffectiveStreak(progress, today)} onInfoClick={() => setInfoModalKey('streak')} />
          <StatPill icon="⚡" label={t('home.xp')} value={progress.xp} onInfoClick={() => setInfoModalKey('xp')} />
          {/* Only a student with a linked parent has anything to cash out —
              no parent means no wallet, no coins, no payout button (see
              WalletScreen.jsx's own redirect-home guard for the same rule
              enforced server-side too). Reappears automatically the next
              time the profile is refetched (login, session restore) once a
              parent links — has_linked_parent comes from get-profile.js. */}
          {user.has_linked_parent && (
            <StatPill
              icon="🪙"
              label={t('home.coins')}
              value={progress.coins}
              onInfoClick={() => setInfoModalKey('coins')}
              onClick={() => (isPremiumUnlocked(user.subscription_status) ? setShowWallet(true) : setShowUpgradeModal('default'))}
            />
          )}
        </div>

        <TrialBanner
          subscriptionStatus={user.subscription_status}
          daysRemainingInTrial={user.days_remaining_in_trial}
          onUpgradeClick={() => setShowUpgradeModal('trial')}
        />

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
                  🔥 <strong>@{share.senderUsername}</strong> {t('home.sharedScoreWithYouBang')}
                </p>
                <button type="button" className="btn btn-primary btn-small" onClick={() => handleViewShare(share)}>
                  {t('home.viewScore')}
                </button>
              </div>
            ))}
          </div>
        )}

        {homework.length > 0 && (
          <div className="friend-request-banner-list">
            {homework.map((hw) =>
              hw.completed ? (
                <div key={hw.id} className="homework-banner homework-banner--done">
                  <p className="homework-banner-text">{t('home.homeworkCompleted', { title: hw.title })}</p>
                </div>
              ) : (
                <button key={hw.id} type="button" className="homework-banner" onClick={() => setActiveHomework(hw)}>
                  <p className="homework-banner-text">
                    {t('home.homeworkDue', { date: formatLongDate(hw.dueDate), title: hw.title })}
                  </p>
                </button>
              )
            )}
          </div>
        )}

        <div className="home-actions">
          <div className="home-action-wrap">
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowLeaderboard(true)}>
              {t('nav.leaderboard')}
            </button>
            <button
              type="button"
              className="info-badge"
              onClick={() => setInfoModalKey('leaderboard')}
              aria-label={t('home.whatIsLeaderboard')}
            >
              i
            </button>
          </div>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowFriends(true)}>
            {t('nav.friends')}
          </button>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowCalendar(true)}>
            {t('nav.calendar')}
          </button>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowClasses(true)}>
            {t('nav.classes')}
          </button>
        </div>

        <div className="calendar-nav">
          <button
            type="button"
            className="calendar-nav-arrow"
            onClick={() => setSelectedDate(addDaysStr(selectedDate, -1))}
            disabled={selectedDate <= LAUNCH_DATE}
            aria-label={t('home.previousDay')}
          >
            ←
          </button>
          <span className="calendar-nav-label">{formatLongDate(selectedDate)}</span>
          <button
            type="button"
            className="calendar-nav-arrow"
            onClick={() => setSelectedDate(addDaysStr(selectedDate, 1))}
            disabled={selectedDate >= today}
            aria-label={t('home.nextDay')}
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
            icon={infoContent[infoModalKey].icon}
            title={infoContent[infoModalKey].title}
            text={infoContent[infoModalKey].text}
            onClose={() => setInfoModalKey(null)}
          />
        )}

        {viewingShare && <FriendScoreCardModal share={viewingShare} onClose={() => setViewingShare(null)} />}

        {showUpgradeModal && <UpgradeModal user={user} context={showUpgradeModal} onClose={() => setShowUpgradeModal(null)} />}
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
      isPremium={isPremiumUnlocked(user.subscription_status)}
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
      onOpenCurriculumTopic={(focus) => {
        setCurriculumFocus(focus)
        setShowCurriculum(true)
      }}
      onBack={() => setPickedSubjectId(null)}
      onLogout={onLogout}
      onLogoClick={handleLogoClick}
    />
  )
}
