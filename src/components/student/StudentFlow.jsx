import { useEffect, useMemo, useState } from 'react'
import {
  getProgress,
  getPendingFriendRequests,
  respondToFriendRequest,
  getActiveStudyPlan,
  completeStudyPlan,
  cancelStudyPlan,
  getTodaysReceivedShares,
} from '../../lib/storage'
import { getSubject } from '../../lib/questions'
import { getEffectiveStreak, countCorrectSubjectsToday, todayStr, TOTAL_SUBJECTS } from '../../lib/streak'
import TopBar from '../shared/TopBar'
import SubjectDashboard from './SubjectDashboard'
import StudentHome from './StudentHome'
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

// Explanations shown by the "?" info badges on the home screen's stats and
// action buttons — keyed to match the setInfoModalKey() calls below.
const INFO_CONTENT = {
  streak: {
    icon: '🔥',
    title: 'Day Streak',
    text: "Your streak counts how many days in a row you've answered all 6 subjects correctly. Miss even one subject and the day doesn't count — miss a full day and it resets to zero. Keep it alive to earn bonus coins at 7, 14 and 30 days!",
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
  share: {
    icon: '📤',
    title: 'Share My Streak',
    text: 'Share your daily answer streak with friends on Zyndal or post it to Snapchat, Instagram or Discord. Build a share streak by sharing with the same friend every day — just like Snapchat!',
  },
}

export default function StudentFlow({ user, onLogout, onUserUpdate }) {
  const today = todayStr()
  const [progress, setProgress] = useState(null)
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
        localStorage.setItem('zyndal_last_streak', String(getEffectiveStreak(p, todayStr())))
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

  const completedSubjectIds = useMemo(() => {
    const ids = new Set()
    if (!progress) return ids
    for (const entry of progress.history) {
      if (entry.date === today && entry.correct) ids.add(entry.subjectId)
    }
    return ids
  }, [progress, today])

  // Only worth warning about if there's an actual streak in progress to lose,
  // and only after 8pm local time so it doesn't nag all day.
  const subjectsLeftToday = progress ? TOTAL_SUBJECTS - countCorrectSubjectsToday(progress.history, today) : TOTAL_SUBJECTS
  const showStreakRiskWarning =
    Boolean(progress) &&
    getEffectiveStreak(progress, today) > 0 &&
    subjectsLeftToday > 0 &&
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
          <div className="home-action-wrap">
            <button
              type="button"
              className="btn btn-secondary btn-small share-streak-btn"
              onClick={() => setShowShareScreen(true)}
            >
              Share my streak 📤
              {receivedShareCount > 0 && <span className="notification-badge notification-badge--left">{receivedShareCount}</span>}
            </button>
            <button
              type="button"
              className="info-badge"
              onClick={() => setInfoModalKey('share')}
              aria-label="What is Share my streak?"
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
            ⚠️ Your streak expires at midnight — {subjectsLeftToday} subject{subjectsLeftToday === 1 ? '' : 's'} left!
          </div>
        )}

        <SubjectDashboard completedSubjectIds={completedSubjectIds} onSelectSubject={setPickedSubjectId} />

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
      onProgressChange={setProgress}
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
      onBack={() => setPickedSubjectId(null)}
      onLogout={onLogout}
      onLogoClick={handleLogoClick}
    />
  )
}
