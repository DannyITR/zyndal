import { useEffect, useState } from 'react'
import { getTeacherStats } from '../../lib/storage'
import TopBar from '../shared/TopBar'
import SettingsScreen from '../shared/SettingsScreen'
import MyClassesScreen from './MyClassesScreen'
import ClassDetailScreen from './ClassDetailScreen'
import AssignHomeworkScreen from './AssignHomeworkScreen'
import TeacherLeaderboardScreen from './TeacherLeaderboardScreen'

const SHARE_URL_BASE = 'https://zyndal.ca'

// Top-level component for a teacher account — completely separate from
// StudentFlow and ParentDashboard (see App.jsx's account_type routing).
// Same screen-switch-via-state pattern those two use (no router), and
// reuses SettingsScreen.jsx as-is per the spec's "same settings page as
// other account types."
export default function TeacherFlow({ user, onLogout, onUserUpdate }) {
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState('')
  const [view, setView] = useState('home') // home | classes | class-detail | assign-homework | leaderboard | settings
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [shareStatus, setShareStatus] = useState('') // '' | 'copied'

  function loadStats() {
    getTeacherStats()
      .then(setStats)
      .catch((err) => setStatsError(err.message || 'Failed to load stats.'))
  }

  useEffect(loadStats, [])

  function goHome() {
    setView('home')
    setSelectedClassId(null)
    loadStats()
  }

  function handleOpenClass(classId) {
    setSelectedClassId(classId)
    setView('class-detail')
  }

  async function handleShare() {
    const url = `${SHARE_URL_BASE}?ref=${encodeURIComponent(user.username)}`
    const shareData = { title: 'Zyndal', text: 'Join me on Zyndal — daily questions, real rewards!', url }
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData)
      } catch {
        // AbortError (user cancelled the share sheet) or any other failure
        // — nothing to recover from, just don't fall through to clipboard
        // since the user may have cancelled on purpose.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareStatus('copied')
      setTimeout(() => setShareStatus(''), 2000)
    } catch {
      setShareStatus('')
    }
  }

  if (view === 'settings') {
    return <SettingsScreen user={user} onBack={goHome} onLogout={onLogout} onSaved={onUserUpdate} onLogoClick={goHome} />
  }

  if (view === 'leaderboard') {
    return <TeacherLeaderboardScreen user={user} onBack={goHome} onLogout={onLogout} onLogoClick={goHome} />
  }

  if (view === 'assign-homework') {
    return (
      <AssignHomeworkScreen
        user={user}
        onBack={goHome}
        onLogout={onLogout}
        onLogoClick={goHome}
        onCreated={() => {
          setView('classes')
        }}
      />
    )
  }

  if (view === 'class-detail' && selectedClassId) {
    return (
      <ClassDetailScreen
        user={user}
        classId={selectedClassId}
        onBack={() => setView('classes')}
        onLogout={onLogout}
        onLogoClick={goHome}
      />
    )
  }

  if (view === 'classes') {
    return (
      <MyClassesScreen
        user={user}
        onBack={goHome}
        onLogout={onLogout}
        onLogoClick={goHome}
        onOpenClass={handleOpenClass}
      />
    )
  }

  const greetingName = user.display_name || user.username
  const avatarPrefix = user.avatar ? `${user.avatar} ` : ''

  return (
    <div className="screen teacher-screen">
      <TopBar
        title={`${avatarPrefix}Hey, ${greetingName} 👋`}
        subtitle="Teacher Dashboard"
        username={user.username}
        onLogout={onLogout}
        onSettings={() => setView('settings')}
        onLogoClick={goHome}
      />

      {statsError && <p className="form-error">{statsError}</p>}

      <div className="teacher-stats-row">
        <div className="teacher-stat-card">
          <p className="teacher-stat-value">{stats ? stats.totalClasses : '…'}</p>
          <p className="teacher-stat-label">Classes</p>
        </div>
        <div className="teacher-stat-card">
          <p className="teacher-stat-value">{stats ? stats.totalStudents : '…'}</p>
          <p className="teacher-stat-label">Students</p>
        </div>
        <div className="teacher-stat-card">
          <p className="teacher-stat-value">{stats ? stats.activeToday : '…'}</p>
          <p className="teacher-stat-label">Active Today</p>
        </div>
        <div className="teacher-stat-card">
          <p className="teacher-stat-value">{stats ? stats.assignmentsDueThisWeek : '…'}</p>
          <p className="teacher-stat-label">Due This Week</p>
        </div>
      </div>

      <div className="home-actions">
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setView('classes')}>
          🏫 My Classes
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setView('assign-homework')}>
          📚 Assign Homework
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setView('leaderboard')}>
          🏆 Leaderboard
        </button>
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={handleShare}>
        {shareStatus === 'copied' ? 'Link copied!' : '📣 Share Zyndal with Students'}
      </button>
    </div>
  )
}
