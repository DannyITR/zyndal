import { useEffect, useState } from 'react'
import { getSubject } from '../../../lib/questions'
import { getGradesForUser } from '../../../lib/storage'
import { averageGrade, computeSubjectAverages, gradeBand } from '../../../lib/grades'
import TopBar from '../../shared/TopBar'
import LogGradeModal from './LogGradeModal'

export default function GradesScreen({ user, lockedSubjectId, onBack, onLogout, onLogoClick }) {
  const [grades, setGrades] = useState(null)
  const [showLogModal, setShowLogModal] = useState(false)

  async function refresh() {
    const list = await getGradesForUser(user.id)
    setGrades(list)
  }

  useEffect(() => {
    let cancelled = false
    getGradesForUser(user.id).then((list) => {
      if (!cancelled) setGrades(list)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  const filteredGrades = grades
    ? lockedSubjectId
      ? grades.filter((g) => g.subject === lockedSubjectId)
      : grades
    : null

  const overallAverage = filteredGrades ? averageGrade(filteredGrades) : null
  const subjectAverages = filteredGrades ? computeSubjectAverages(filteredGrades) : {}

  return (
    <div className="screen student-screen">
      <TopBar
        title="📊 My Grades"
        subtitle="Track any grade, any time"
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <button type="button" className="btn btn-primary btn-block" onClick={() => setShowLogModal(true)}>
        + Log a Grade
      </button>

      {!filteredGrades ? (
        <p className="loading-text">Loading…</p>
      ) : filteredGrades.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-emoji">📊</p>
          <p>No grades logged yet.</p>
          <p className="field-hint">Log any test or assignment grade to start tracking.</p>
        </div>
      ) : (
        <>
          <div className="testprep-header-card grades-overall-card">
            <p className="grades-overall-label">{lockedSubjectId ? 'Average' : 'Overall average'}</p>
            <p className={`grades-overall-value grade-text--${gradeBand(overallAverage)}`}>{overallAverage}%</p>
          </div>

          {!lockedSubjectId && (
            <div className="grades-subject-averages">
              {Object.entries(subjectAverages).map(([subjectId, avg]) => {
                const subject = getSubject(subjectId)
                return (
                  <div key={subjectId} className="grades-subject-average-row">
                    <span>
                      {subject?.icon} {subject?.name || subjectId} average
                    </span>
                    <span className={`grade-text--${gradeBand(avg)}`}>{avg}%</span>
                  </div>
                )
              })}
            </div>
          )}

          <ul className="grades-list">
            {filteredGrades.map((g) => {
              const subject = getSubject(g.subject)
              return (
                <li key={g.id} className={`grades-row grades-row--${gradeBand(g.grade_percentage)}`}>
                  <div className="grades-row-info">
                    <p className="grades-row-title">
                      {subject?.icon} {subject?.name || g.subject} — {g.test_name}
                    </p>
                    <p className="grades-row-detail">
                      {g.test_date}
                      {g.notes ? ` · ${g.notes}` : ''}
                    </p>
                  </div>
                  <span className={`grades-row-percentage grade-text--${gradeBand(g.grade_percentage)}`}>
                    {g.grade_percentage}%
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {showLogModal && (
        <LogGradeModal
          user={user}
          lockedSubjectId={lockedSubjectId}
          onSaved={async () => {
            setShowLogModal(false)
            await refresh()
          }}
          onClose={() => setShowLogModal(false)}
        />
      )}
    </div>
  )
}
