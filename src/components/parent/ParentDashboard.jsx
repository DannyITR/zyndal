import { useEffect, useState } from 'react'
import {
  getStudentsForParent,
  getStudentProgress,
  getActiveStudyPlansForParent,
  getTestGradesForParent,
  getStudentPracticeSessions,
  getStudentGrades,
  getPendingInvitationsForParent,
  getNotifications,
} from '../../lib/storage'
import { SUBJECTS, getSubject } from '../../lib/questions'
import { countdownLabel, computeReadiness } from '../../lib/testprep'
import TopBar from '../shared/TopBar'
import AnswerDetail from '../shared/AnswerDetail'
import Leaderboard from '../shared/Leaderboard'
import SettingsScreen from '../shared/SettingsScreen'
import NotificationsScreen from '../student/notifications/NotificationsScreen'
import FinanceScreen from './finance/FinanceScreen'
import AddChildScreen from './AddChildScreen'
import StudentCard from './StudentCard'
import GradeBadge from '../student/uploads/GradeBadge'

export default function ParentDashboard({ user, onLogout, onUserUpdate }) {
  const [students, setStudents] = useState(null)
  const [progressByStudent, setProgressByStudent] = useState({})
  const [studyPlans, setStudyPlans] = useState(null)
  const [testGrades, setTestGrades] = useState(null)
  const [practiceByStudent, setPracticeByStudent] = useState({})
  const [gradesByStudent, setGradesByStudent] = useState({})
  const [pendingInvitations, setPendingInvitations] = useState([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [viewingEntry, setViewingEntry] = useState(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showFinances, setShowFinances] = useState(false)
  const [showAddChild, setShowAddChild] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  // The logo always resets to the main dashboard view for a logged-in parent.
  function handleLogoClick() {
    if (showFinances) refreshStudentProgress()
    setShowLeaderboard(false)
    setShowSettings(false)
    setShowFinances(false)
    setShowAddChild(false)
    setShowNotifications(false)
    setViewingEntry(null)
  }

  function refreshPendingInvitations() {
    getPendingInvitationsForParent(user.id)
      .then(setPendingInvitations)
      .catch(() => {})
  }

  useEffect(refreshPendingInvitations, [user.id])

  useEffect(() => {
    let cancelled = false
    getNotifications().then(({ unreadCount }) => {
      if (!cancelled) setUnreadNotificationCount(unreadCount)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  useEffect(() => {
    let cancelled = false
    getStudentsForParent(user.id).then((list) => {
      if (!cancelled) setStudents(list)
    })
    getActiveStudyPlansForParent(user.id).then((plans) => {
      if (!cancelled) setStudyPlans(plans)
    })
    getTestGradesForParent(user.id).then((grades) => {
      if (!cancelled) setTestGrades(grades)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  useEffect(() => {
    if (!students || students.length === 0) return
    let cancelled = false
    Promise.all(students.map((s) => getStudentProgress(user.id, s.id).then((p) => [s.id, p]))).then((pairs) => {
      if (!cancelled) setProgressByStudent(Object.fromEntries(pairs))
    })
    Promise.all(students.map((s) => getStudentPracticeSessions(user.id, s.id).then((list) => [s.id, list]))).then((pairs) => {
      if (!cancelled) setPracticeByStudent(Object.fromEntries(pairs))
    })
    Promise.all(students.map((s) => getStudentGrades(user.id, s.id).then((list) => [s.id, list]))).then((pairs) => {
      if (!cancelled) setGradesByStudent(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [students, user.id])

  // Coin balances can change on the Finance page (payouts) without this
  // dashboard's own progress snapshot knowing, so refetch on the way back.
  async function refreshStudentProgress() {
    if (!students || students.length === 0) return
    const pairs = await Promise.all(students.map((s) => getStudentProgress(user.id, s.id).then((p) => [s.id, p])))
    setProgressByStudent(Object.fromEntries(pairs))
  }

  if (viewingEntry) {
    return (
      <AnswerDetail
        entry={viewingEntry}
        username={user.username}
        onBack={() => setViewingEntry(null)}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showLeaderboard) {
    return (
      <Leaderboard
        highlightUserIds={new Set((students || []).map((s) => s.id))}
        subtitle="Your students are highlighted"
        username={user.username}
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

  if (showFinances) {
    return (
      <FinanceScreen
        user={user}
        onBack={() => {
          setShowFinances(false)
          refreshStudentProgress()
        }}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  if (showAddChild) {
    return (
      <AddChildScreen
        user={user}
        onBack={() => setShowAddChild(false)}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
        onChanged={refreshPendingInvitations}
      />
    )
  }

  if (showNotifications) {
    return (
      <NotificationsScreen
        user={user}
        onBack={() => {
          setShowNotifications(false)
          getNotifications().then(({ unreadCount }) => setUnreadNotificationCount(unreadCount))
        }}
        onLogout={onLogout}
        onLogoClick={handleLogoClick}
      />
    )
  }

  const greetingName = user.display_name || user.username
  const avatarPrefix = user.avatar ? `${user.avatar} ` : ''

  return (
    <div className="screen parent-screen">
      <TopBar
        title={`${avatarPrefix}Hey, ${greetingName} 👋`}
        subtitle="Parent Dashboard"
        username={user.username}
        onLogout={onLogout}
        onNotifications={() => setShowNotifications(true)}
        unreadCount={unreadNotificationCount}
        onSettings={() => setShowSettings(true)}
        onLogoClick={handleLogoClick}
      />

      <div className="home-actions">
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowFinances(true)}>
          💳 Finances
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowLeaderboard(true)}>
          🏆 Leaderboard
        </button>
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={() => setShowAddChild(true)}>
        ➕ Add Child
      </button>

      {pendingInvitations.length > 0 && (
        <div className="finance-section-card">
          <h3 className="section-heading">Pending Invitations</h3>
          <div className="teacher-student-list">
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="finance-student-row">
                <p className="finance-student-name">{inv.label}</p>
                <span className="plan-status-badge plan-status-badge--pending">Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {studyPlans && studyPlans.length > 0 && (
        <>
          <h3 className="section-heading">Test Prep</h3>
          <div className="testprep-parent-list">
            {studyPlans.map((plan) => {
              const subjectName = SUBJECTS.find((s) => s.id === plan.subject)?.name || plan.subject
              const readiness = computeReadiness(plan.plan_data)
              return (
                <div key={plan.id} className="testprep-parent-row">
                  <div className="testprep-parent-info">
                    <p className="testprep-parent-title">
                      {plan.studentName} — {subjectName} {plan.topic}
                    </p>
                    <p className="testprep-parent-detail">
                      {countdownLabel(subjectName, plan.test_date).toLowerCase()} — {readiness}% ready
                    </p>
                  </div>
                  <div className="weekly-progress-bar testprep-parent-bar">
                    <div className="weekly-progress-fill" style={{ width: `${readiness}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {testGrades && testGrades.length > 0 && (
        <>
          <h3 className="section-heading">Test Grades</h3>
          <div className="testprep-parent-list">
            {testGrades.map((upload) => {
              const subjectName = getSubject(upload.subject)?.name || upload.subject
              return (
                <div key={upload.id} className="testprep-parent-row testprep-parent-row--inline">
                  <div className="testprep-parent-info">
                    <p className="testprep-parent-title">
                      {upload.studentName} — {subjectName} {upload.topic}
                    </p>
                    <p className="testprep-parent-detail">{upload.test_date || upload.created_at.slice(0, 10)}</p>
                  </div>
                  <GradeBadge grade={upload.grade_received} />
                </div>
              )
            })}
          </div>
        </>
      )}

      <h3 className="section-heading">Your Students</h3>

      {!students ? (
        <p className="loading-text">Loading…</p>
      ) : students.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-emoji">🔗</p>
          <p>No students linked yet.</p>
          <p className="field-hint">Share your code above — they'll enter it when they sign up.</p>
        </div>
      ) : (
        <div className="student-list">
          {students.map((student) => {
            const progress = progressByStudent[student.id]
            if (!progress) return null
            return (
              <StudentCard
                key={student.id}
                student={student}
                progress={progress}
                practiceSessions={practiceByStudent[student.id] || []}
                grades={gradesByStudent[student.id] || []}
                workSubmissions={student.workSubmissions || []}
                onSelectEntry={setViewingEntry}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
