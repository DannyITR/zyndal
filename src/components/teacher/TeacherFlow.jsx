import { useEffect, useState } from 'react'
import { getTeacherStats, getRecentHomework } from '../../lib/storage'
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
  const [recentHomework, setRecentHomework] = useState(null)
  const [recentHomeworkError, setRecentHomeworkError] = useState('')
  const [view, setView] = useState('home') // home | classes | class-detail | assign-homework | leaderboard | settings
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [assignHomeworkClass, setAssignHomeworkClass] = useState(null) // { id, name } — the class Assign Homework was opened from
  const [shareStatus, setShareStatus] = useState('') // '' | 'copied'

  function loadStats() {
    getTeacherStats()
      .then(setStats)
      .catch((err) => setStatsError(err.message || 'Failed to load stats.'))
  }

  function loadRecentHomework() {
    getRecentHomework()
      .then((data) => setRecentHomework(data.homework))
      .catch((err) => setRecentHomeworkError(err.message || 'Failed to load recent homework.'))
  }

  useEffect(() => {
    loadStats()
    loadRecentHomework()
  }, [])

  function goHome() {
    setView('home')
    setSelectedClassId(null)
    setAssignHomeworkClass(null)
    loadStats()
    loadRecentHomework()
  }

  function handleOpenClass(classId) {
    setSelectedClassId(classId)
    setView('class-detail')
  }

  function handleAssignHomework(classRow) {
    setAssignHomeworkClass({ id: classRow.id, name: classRow.name })
    setView('assign-homework')
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

  if (view === 'assign-homework' && assignHomeworkClass) {
    return (
      <AssignHomeworkScreen
        user={user}
        classId={assignHomeworkClass.id}
        className={assignHomeworkClass.name}
        onBack={() => setView('class-detail')}
        onLogout={onLogout}
        onLogoClick={goHome}
        onCreated={() => setView('class-detail')}
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
        onAssignHomework={handleAssignHomework}
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
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setView('leaderboard')}>
          🏆 Leaderboard
        </button>
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={handleShare}>
        {shareStatus === 'copied' ? 'Link copied!' : '📣 Share Zyndal with Students'}
      </button>

      <h3 className="section-heading">Recent Homework</h3>
      {recentHomeworkError && <p className="form-error">{recentHomeworkError}</p>}
      {!recentHomework && !recentHomeworkError && <p className="loading-text">Loading…</p>}
      {recentHomework && recentHomework.length === 0 && (
        <p className="field-hint">No homework assigned yet — open a class to assign your first one.</p>
      )}
      {recentHomework && recentHomework.length > 0 && (
        <div className="teacher-recent-homework-list">
          {recentHomework.map((h) => (
            <button
              key={h.id}
              type="button"
              className="teacher-recent-homework-row"
              onClick={() => handleOpenClass(h.classId)}
            >
              <p className="teacher-class-name">
                {h.className} — {h.title}
              </p>
              <p className="teacher-class-detail">
                Due {new Date(`${h.dueDate}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC' })} · {h.completedCount}/
                {h.totalEnrolled} students completed
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
