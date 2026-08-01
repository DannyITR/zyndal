import { useEffect, useState } from 'react'
import { getClassDetail } from '../../lib/storage'
import TopBar from '../shared/TopBar'
import SubmissionDetailModal from './SubmissionDetailModal'
import SetCurrentUnitModal from './SetCurrentUnitModal'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { timeZone: 'UTC' })
}

export default function ClassDetailScreen({ user, classId, onBack, onLogout, onLogoClick }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [expandedAssignmentId, setExpandedAssignmentId] = useState(null)
  const [viewingSubmission, setViewingSubmission] = useState(null) // { assignmentId, studentId, username }
  const [copied, setCopied] = useState(false)
  const [showSetUnit, setShowSetUnit] = useState(false)

  useEffect(() => {
    let cancelled = false
    getClassDetail(classId)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Couldn't load this class.")
      })
    return () => {
      cancelled = true
    }
  }, [classId])

  function handleCopyCode() {
    navigator.clipboard?.writeText(detail.class.teacher_code).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {}
    )
  }

  if (error) {
    return (
      <div className="screen">
        <TopBar title="Class" username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />
        <p className="form-error">{error}</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="screen">
        <TopBar title="Class" username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />
        <p className="loading-text">Loading…</p>
      </div>
    )
  }

  return (
    <div className="screen">
      <TopBar
        title={detail.class.name}
        subtitle={`Grade ${detail.class.grade} · ${detail.class.school}`}
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <div className="parent-code-card">
        <p className="parent-code-label">Class code</p>
        <div className="parent-code-value-row">
          <span className="parent-code-value">{detail.class.teacher_code}</span>
          <button type="button" className="btn btn-secondary btn-small" onClick={handleCopyCode}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="finance-section-card">
        <p className="field-hint">Currently studying</p>
        <p className="teacher-current-unit">
          📖 Unit {detail.class.current_unit_number ?? 1}
          {detail.class.current_unit_title ? ` — ${detail.class.current_unit_title}` : ''}
        </p>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowSetUnit(true)}>
          Set Current Unit
        </button>
      </div>

      <h3 className="section-heading">Students ({detail.students.length})</h3>
      {detail.students.length === 0 ? (
        <p className="field-hint">No students have joined yet — share the code above.</p>
      ) : (
        <div className="teacher-student-list">
          {detail.students.map((s) => (
            <div key={s.studentId} className="finance-student-row">
              <div>
                <p className="finance-student-name">
                  {s.avatar ? `${s.avatar} ` : ''}@{s.username}
                </p>
                <p className="finance-student-detail">
                  🔥 {s.currentStreak} · ⚡ {s.totalXp} XP · Last active {formatDate(s.lastActive)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="section-heading">Assignments ({detail.assignments.length})</h3>
      {detail.assignments.length === 0 ? (
        <p className="field-hint">No homework assigned to this class yet.</p>
      ) : (
        <div className="teacher-assignment-list">
          {detail.assignments.map((a) => (
            <div key={a.id} className="teacher-assignment-card">
              <button
                type="button"
                className="teacher-assignment-card-header"
                onClick={() => setExpandedAssignmentId(expandedAssignmentId === a.id ? null : a.id)}
              >
                <div>
                  <p className="teacher-class-name">{a.title}</p>
                  <p className="teacher-class-detail">
                    {a.subject} · Due {formatDate(a.dueDate)} · {a.questionCount} question{a.questionCount === 1 ? '' : 's'}
                  </p>
                </div>
                <p className="teacher-class-detail">
                  {a.completedCount}/{a.totalEnrolled} completed
                  {a.averageScorePercent !== null ? ` · avg ${a.averageScorePercent}%` : ''}
                </p>
              </button>

              {expandedAssignmentId === a.id && (
                <div className="teacher-assignment-students">
                  {a.students.map((st) => (
                    <button
                      key={st.studentId}
                      type="button"
                      className="finance-student-row finance-student-row--clickable"
                      onClick={() => setViewingSubmission({ assignmentId: a.id, studentId: st.studentId, username: st.username })}
                    >
                      <p className="finance-student-name">@{st.username}</p>
                      <p className="finance-student-detail">
                        {st.status === 'completed' ? `✅ ${st.scorePercentage}% — ${formatDate(st.completedAt)}` : 'Not submitted'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <h3 className="section-heading">Class Leaderboard</h3>
      {detail.leaderboard.length === 0 ? (
        <p className="field-hint">No students yet.</p>
      ) : (
        <ol className="leaderboard-list">
          {detail.leaderboard.map((s, i) => (
            <li key={s.studentId} className="leaderboard-row">
              <div className="leaderboard-row-main">
                <span className={`leaderboard-rank ${i < 3 ? `leaderboard-rank--${i + 1}` : ''}`}>{i + 1}</span>
                <div className="leaderboard-info">
                  <p className="leaderboard-username">@{s.username}</p>
                </div>
                <div className="leaderboard-stats">
                  <span className="leaderboard-streak">🔥 {s.currentStreak}</span>
                  <span className="leaderboard-xp">⚡ {s.totalXp} XP</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {viewingSubmission && (
        <SubmissionDetailModal
          assignmentId={viewingSubmission.assignmentId}
          studentId={viewingSubmission.studentId}
          username={viewingSubmission.username}
          onClose={() => setViewingSubmission(null)}
        />
      )}

      {showSetUnit && (
        <SetCurrentUnitModal
          classId={detail.class.id}
          classGrade={detail.class.grade}
          onSaved={(updatedClass) => setDetail((prev) => ({ ...prev, class: updatedClass }))}
          onClose={() => setShowSetUnit(false)}
        />
      )}
    </div>
  )
}
