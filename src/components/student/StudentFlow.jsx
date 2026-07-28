import { useEffect, useMemo, useState } from 'react'
import {
  getProgress,
  getDailyProgress,
  getPendingFriendRequests,
  respondToFriendRequest,
  getActiveStudyPlan,
  completeStudyPlan,
  cancelStudyPlan,
  getTodaysReceivedShares,
} from '../../lib/storage'
import { getSubject } from '../../lib/questions'
import { getEffectiveStreak, todayStr } from '../../lib/streak'
import { getUserTimeZone } from '../../lib/timezone'
import TopBar from '../shared/TopBar'
import SubjectDashboard from './SubjectDashboard'
import StudentHome from './StudentHome'
import CalendarScreen from './CalendarScreen'
import DayReviewScreen from './DayReviewScreen'
import Leaderboard from '../shared/Leaderboard'
import SettingsScreen from '../shared/SettingsScreen'
import ShareStreakScreen from './share/ShareStreakScreen'
import StreakFlame from './StreakFlame'
import StatPill from './StatPill'
import InfoModal from './InfoModal'
import FriendsScreen from './friends/FriendsScreen'
import FriendRequestBanner from './friends/FriendRequestBanner'
import TestPrepSetupScreen from './testprep/TestPrepSetupScreen'
import StudyPlanScreen from './testprep/StudyPlanScreen'
import StudyGuideScreen from './testprep/StudyGuideScreen'
import UploadsFlow from './uploads/UploadsFlow'
import PracticeFlow from './practice/PracticeFlow'
import GradesScreen from './grades/GradesScreen'
import CurriculumOutlineScreen from './curriculum/CurriculumOutlineScreen'

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
  const [receivedShareCount, setReceivedShareCount] = useState(0)
  const [activePlan, setActivePlan] = useState(null)
  const [showTestPrepSetup, setShowTestPrepSetup] = useState(false)
  const [showStudyPlan, setShowStudyPlan] = useState(false)
  const [showStudyGuide, setShowStudyGuide] = useState(false)
  const [uploadsView, setUploadsView] = useState(null) // null | 'select-type' | 'library'
  const [showPractice, setShowPractice] = useState(false)
  const [showGrades, setShowGrades] = useState(false)
  const [showCurriculum, setShowCurriculum] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [reviewDate, setReviewDate] = useState(null) // YYYY-MM-DD | null — takes priority over showCalendar when set

  // user.linked_parent_deleted comes from login/get-profile (see
  // api/_lib/db.js's isLinkedParentDeleted) — shown once per mount, then
  // auto-dismisses on its own after 5s (still manually closeable sooner).
  const [showParentDeletedBanner, setShowParentDeletedBanner] = useState(Boolean(user.linked_parent_deleted))
  useEffect(() => {
    if (!user.linked_parent_deleted) return
    const timer = setTimeout(() => setShowParentDeletedBanner(false), 5000)
    return () => clearTimeout(timer)
  }, [user.linked_parent_deleted])

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
    setReviewDate(null)
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

  // DayReviewScreen.jsx calls this after a late (past-day) answer —
  // api/student/submit-late-answer.js already enforced XP-only/no-streak
  // server-side, so this just appends the entry and adds its XP locally,
  // matching that exactly. Never touches coins/streak/dailyProgress: a past
  // day's answer was never "today" and shouldn't move any of those.
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

  useEffect(() => {
    let cancelled = false
    getTodaysReceivedShares(user.id).then((list) => {
      if (!cancelled) setReceivedShareCount(list.length)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

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

  // Sourced from dailyProgress (api/student/get-daily-progress.js), not
  // derived from progress.history locally — see handleProgressChange above
  // for why the grid trusts the server's own local-timezone "today" rather
  // than recomputing it client-side.
  const completedSubjectIds = useMemo(() => new Set(dailyProgress?.completed_subjects ?? []), [dailyProgress])
  const incorrectSubjectIds = useMemo(() => new Set(dailyProgress?.incorrect_subjects ?? []), [dailyProgress])

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
        onBack={() => setShowFriends(false)}
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
        onBack={() => {
          setShowShareScreen(false)
          getTodaysReceivedShares(user.id).then((list) => setReceivedShareCount(list.length))
        }}
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

  if (reviewDate) {
    return (
      <DayReviewScreen
        user={user}
        date={reviewDate}
        progress={progress}
        onAnswered={handleLateAnswered}
        onBack={() => setReviewDate(null)}
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
        onSelectDay={setReviewDate}
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

        <div className="stats-row">
          <StreakFlame streak={getEffectiveStreak(progress, today)} onInfoClick={() => setInfoModalKey('streak')} />
          <button type="button" className="calendar-icon-btn" onClick={() => setShowCalendar(true)} aria-label="View calendar">
            📅
          </button>
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
          receivedShareCount={receivedShareCount}
        />

        {infoModalKey && (
          <InfoModal
            icon={INFO_CONTENT[infoModalKey].icon}
            title={INFO_CONTENT[infoModalKey].title}
            text={INFO_CONTENT[infoModalKey].text}
            onClose={() => setInfoModalKey(null)}
          />
        )}
      </div>
    )
  }

  return (
    <StudentHome
      user={user}
      subject={activeSubject}
      progress={progress}
      onProgressChange={handleProgressChange}
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
