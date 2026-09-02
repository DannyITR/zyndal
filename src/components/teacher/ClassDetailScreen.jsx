import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getClassDetail } from '../../lib/storage'
import { LOCALE_FOR_LANGUAGE } from '../../lib/i18n'
import { getErrorMessage } from '../../lib/errors'
import TopBar from '../shared/TopBar'
import SubmissionDetailModal from './SubmissionDetailModal'
import SetCurrentUnitModal from './SetCurrentUnitModal'

function formatDate(value, language) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(LOCALE_FOR_LANGUAGE[language] || 'en-US', { timeZone: 'UTC' })
}

export default function ClassDetailScreen({ user, classId, onBack, onLogout, onLogoClick, onAssignHomework, onOpenForum }) {
  const { t, i18n } = useTranslation()
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
        if (!cancelled) setError(getErrorMessage(err, t, 'teacher.loadClassFailed'))
      })
    return () => {
      cancelled = true
    }
    // t is a stable function for the app's lifetime (see src/lib/i18n.js) —
    // not a real dependency, and including it would refetch on every
    // language change for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <TopBar title={t('teacher.classFallbackTitle')} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />
        <p className="form-error">{error}</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="screen">
        <TopBar title={t('teacher.classFallbackTitle')} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />
        <p className="loading-text">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="screen">
      <TopBar
        title={detail.class.name}
        subtitle={`${t('common.gradeLabel', { grade: detail.class.grade })} · ${detail.class.school}`}
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <div className="parent-code-card">
        <p className="parent-code-label">{t('teacher.classCode')}</p>
        <div className="parent-code-value-row">
          <span className="parent-code-value">{detail.class.teacher_code}</span>
          <button type="button" className="btn btn-secondary btn-small" onClick={handleCopyCode}>
            {copied ? t('addChild.copied') : t('teacher.copy')}
          </button>
        </div>
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={() => onAssignHomework(detail.class)}>
        {t('teacher.assignHomework')}
      </button>

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => onOpenForum({ classType: 'class', classId: detail.class.id, className: detail.class.name })}
      >
        {t('forum.title')}
      </button>

      <div className="finance-section-card">
        <p className="field-hint">{t('teacher.currentlyStudying')}</p>
        <p className="teacher-current-unit">
          {t('teacher.unitLabel', { number: detail.class.current_unit_number ?? 1 })}
          {detail.class.current_unit_title ? ` — ${detail.class.current_unit_title}` : ''}
        </p>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowSetUnit(true)}>
          {t('teacher.setCurrentUnit')}
        </button>
      </div>

      <h3 className="section-heading">{t('teacher.studentsHeading', { count: detail.students.length })}</h3>
      {detail.students.length === 0 ? (
        <p className="field-hint">{t('teacher.noStudentsJoined')}</p>
      ) : (
        <div className="teacher-student-list">
          {detail.students.map((s) => (
            <div key={s.studentId} className="finance-student-row">
              <div>
                <p className="finance-student-name">
                  {s.avatar ? `${s.avatar} ` : ''}@{s.username}
                </p>
                <p className="finance-student-detail">
                  🔥 {s.currentStreak} · ⚡ {s.totalXp} XP · {t('teacher.lastActive', { date: formatDate(s.lastActive, i18n.language) })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail.pendingWorkReviewCount > 0 && (
        <div className="daily-status-banner daily-status-banner--pending">
          {t('teacher.pendingWorkReviews', { count: detail.pendingWorkReviewCount })}
        </div>
      )}

      <h3 className="section-heading">{t('teacher.assignmentsHeading', { count: detail.assignments.length })}</h3>
      {detail.assignments.length === 0 ? (
        <p className="field-hint">{t('teacher.noHomeworkAssigned')}</p>
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
                    {t(`subjects.${a.subject}`, { defaultValue: a.subject })} · {t('teacher.dueDateQuestions', { date: formatDate(a.dueDate, i18n.language), count: a.questionCount })}
                  </p>
                </div>
                <p className="teacher-class-detail">
                  {t('teacher.completedCount', { completed: a.completedCount, total: a.totalEnrolled })}
                  {a.averageScorePercent !== null ? ` · ${t('teacher.avgScore', { percent: a.averageScorePercent })}` : ''}
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
                        {st.status === 'completed'
                          ? `✅ ${st.scorePercentage}% — ${formatDate(st.completedAt, i18n.language)}`
                          : t('teacher.notSubmitted')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <h3 className="section-heading">{t('teacher.classLeaderboard')}</h3>
      {detail.leaderboard.length === 0 ? (
        <p className="field-hint">{t('leaderboard.noStudentsYet')}</p>
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
