import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getTeacherStats, getRecentHomework } from '../../lib/storage'
import { LOCALE_FOR_LANGUAGE } from '../../lib/i18n'
import { getErrorMessage } from '../../lib/errors'
import TopBar from '../shared/TopBar'
import SettingsScreen from '../shared/SettingsScreen'
import TrialBanner from '../shared/TrialBanner'
import UpgradeModal from '../shared/UpgradeModal'
import MyClassesScreen from './MyClassesScreen'
import ClassDetailScreen from './ClassDetailScreen'
import AssignHomeworkScreen from './AssignHomeworkScreen'
import TeacherLeaderboardScreen from './TeacherLeaderboardScreen'
import CreateClassModal from './CreateClassModal'
import ClaimClassScreen from './ClaimClassScreen'

const SHARE_URL_BASE = 'https://zyndal.ca'

// Top-level component for a teacher account — completely separate from
// StudentFlow and ParentDashboard (see App.jsx's account_type routing).
// Same screen-switch-via-state pattern those two use (no router), and
// reuses SettingsScreen.jsx as-is per the spec's "same settings page as
// other account types."
export default function TeacherFlow({ user, onLogout, onUserUpdate }) {
  const { t, i18n } = useTranslation()
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState('')
  const [recentHomework, setRecentHomework] = useState(null)
  const [recentHomeworkError, setRecentHomeworkError] = useState('')
  const [view, setView] = useState('home') // home | classes | class-detail | assign-homework | leaderboard | settings | claim-class
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [assignHomeworkClass, setAssignHomeworkClass] = useState(null) // { id, name } — the class Assign Homework was opened from
  const [shareStatus, setShareStatus] = useState('') // '' | 'copied'
  const [showUpgradeModal, setShowUpgradeModal] = useState(null) // null | 'default' | 'trial'
  const [showCreateClass, setShowCreateClass] = useState(false)

  function loadStats() {
    getTeacherStats()
      .then(setStats)
      .catch((err) => setStatsError(getErrorMessage(err, t, 'teacher.loadStatsFailed')))
  }

  function loadRecentHomework() {
    getRecentHomework()
      .then((data) => setRecentHomework(data.homework))
      .catch((err) => setRecentHomeworkError(getErrorMessage(err, t, 'teacher.loadHomeworkFailed')))
  }

  useEffect(() => {
    loadStats()
    loadRecentHomework()
    // loadStats/loadRecentHomework are plain functions redefined every
    // render (only recently started closing over `t` from useTranslation,
    // which is what surfaced this warning) — this effect should only run
    // once on mount, same as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const shareData = { title: 'Zyndal', text: t('teacher.shareText'), url }
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

  if (view === 'claim-class') {
    return <ClaimClassScreen user={user} onBack={goHome} onLogout={onLogout} onLogoClick={goHome} />
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
        title={`${avatarPrefix}${t('common.greeting', { name: greetingName })}`}
        subtitle={t('teacher.subtitle')}
        username={user.username}
        onLogout={onLogout}
        onSettings={() => setView('settings')}
        onLogoClick={goHome}
      />

      {statsError && <p className="form-error">{statsError}</p>}

      {stats && stats.totalClasses === 0 ? (
        <div className="empty-state">
          <p className="empty-state-emoji">🏫</p>
          <p>{t('teacher.dashboardEmptyTitle')}</p>
          <p className="field-hint">{t('teacher.dashboardEmptyHint')}</p>
          <button type="button" className="btn btn-primary" onClick={() => setShowCreateClass(true)}>
            {t('teacher.createClass')}
          </button>
        </div>
      ) : (
        <div className="teacher-stats-row">
          <div className="teacher-stat-card">
            <p className="teacher-stat-value">{stats ? stats.totalClasses : '…'}</p>
            <p className="teacher-stat-label">{t('teacher.classesLabel')}</p>
          </div>
          <div className="teacher-stat-card">
            <p className="teacher-stat-value">{stats ? stats.totalStudents : '…'}</p>
            <p className="teacher-stat-label">{t('teacher.studentsLabel')}</p>
          </div>
          <div className="teacher-stat-card">
            <p className="teacher-stat-value">{stats ? stats.activeToday : '…'}</p>
            <p className="teacher-stat-label">{t('teacher.activeTodayLabel')}</p>
          </div>
          <div className="teacher-stat-card">
            <p className="teacher-stat-value">{stats ? stats.assignmentsDueThisWeek : '…'}</p>
            <p className="teacher-stat-label">{t('teacher.dueThisWeekLabel')}</p>
          </div>
        </div>
      )}

      <TrialBanner
        subscriptionStatus={user.subscription_status}
        daysRemainingInTrial={user.days_remaining_in_trial}
        onUpgradeClick={() => setShowUpgradeModal(user.subscription_status === 'trial_active' ? 'trial' : 'default')}
      />

      <div className="home-actions">
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setView('classes')}>
          {t('teacher.myClasses')}
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setView('leaderboard')}>
          {t('nav.leaderboard')}
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setView('claim-class')}>
          {t('teacher.claimAClass')}
        </button>
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={handleShare}>
        {shareStatus === 'copied' ? t('addChild.linkCopied') : t('teacher.shareWithStudents')}
      </button>

      {(!stats || stats.totalClasses > 0) && (
        <>
          <h3 className="section-heading">{t('teacher.recentHomework')}</h3>
          {recentHomeworkError && <p className="form-error">{recentHomeworkError}</p>}
          {!recentHomework && !recentHomeworkError && <p className="loading-text">{t('common.loading')}</p>}
          {recentHomework && recentHomework.length === 0 && (
            <p className="field-hint">{t('teacher.noHomeworkYet')}</p>
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
                    {t('teacher.dueDetail', {
                      date: new Date(`${h.dueDate}T00:00:00Z`).toLocaleDateString(LOCALE_FOR_LANGUAGE[i18n.language] || 'en-US', { timeZone: 'UTC' }),
                      completed: h.completedCount,
                      total: h.totalEnrolled,
                    })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {showUpgradeModal && <UpgradeModal user={user} context={showUpgradeModal} onClose={() => setShowUpgradeModal(null)} />}

      {showCreateClass && (
        <CreateClassModal
          onCreated={() => {
            loadStats()
            loadRecentHomework()
          }}
          onClose={() => {
            setShowCreateClass(false)
            loadStats()
            loadRecentHomework()
          }}
        />
      )}
    </div>
  )
}
