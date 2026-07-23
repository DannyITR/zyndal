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
import { getEffectiveStreak, todayStr } from '../../lib/streak'
import TopBar from '../shared/TopBar'
import SubjectDashboard from './SubjectDashboard'
import StudentHome from './StudentHome'
import Leaderboard from '../shared/Leaderboard'
import SettingsScreen from '../shared/SettingsScreen'
import ShareStreakScreen from './share/ShareStreakScreen'
import StreakFlame from './StreakFlame'
import StatPill from './StatPill'
import FriendsScreen from './friends/FriendsScreen'
import FriendRequestBanner from './friends/FriendRequestBanner'
import TestPrepSetupScreen from './testprep/TestPrepSetupScreen'
import StudyPlanScreen from './testprep/StudyPlanScreen'
import StudyGuideScreen from './testprep/StudyGuideScreen'
import UploadsFlow from './uploads/UploadsFlow'
import PracticeFlow from './practice/PracticeFlow'
import GradesScreen from './grades/GradesScreen'

export default function StudentFlow({ user, onLogout, onUserUpdate }) {
  const today = todayStr()
  const [progress, setProgress] = useState(null)
  const [pickedSubjectId, setPickedSubjectId] = useState(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
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
      if (entry.date === today) ids.add(entry.subjectId)
    }
    return ids
  }, [progress, today])

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
          <StreakFlame streak={getEffectiveStreak(progress, today)} />
          <StatPill icon="⚡" label="XP" value={progress.xp} />
          <StatPill icon="🪙" label="Coins" value={progress.coins} />
        </div>

        {pendingFriendRequests && pendingFriendRequests.length > 0 && (
          <div className="friend-request-banner-list">
            {pendingFriendRequests.map((request) => (
              <FriendRequestBanner key={request.id} request={request} onRespond={handleRespondToFriendRequest} />
            ))}
          </div>
        )}

        <div className="home-actions">
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowLeaderboard(true)}>
            🏆 Leaderboard
          </button>
          <button type="button" className="btn btn-secondary btn-small share-streak-btn" onClick={() => setShowShareScreen(true)}>
            📤 Share my streak
            {receivedShareCount > 0 && <span className="notification-badge">{receivedShareCount}</span>}
          </button>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowFriends(true)}>
            👥 Friends
          </button>
        </div>

        <SubjectDashboard completedSubjectIds={completedSubjectIds} onSelectSubject={setPickedSubjectId} />
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
