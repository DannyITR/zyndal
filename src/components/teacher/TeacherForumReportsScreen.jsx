import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getTeacherForumReports, resolveTeacherForumReport } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'
import TopBar from '../shared/TopBar'

// Lighter version of AdminApprovalsScreen.jsx's "Reported Forum Content"
// section — same delete/dismiss actions, but pre-scoped server-side
// (api/teacher/get-forum-reports.js) to only this teacher's own claimed
// classes. Reports on an unclaimed group never appear here — those are
// admin-only, since a group has no owning teacher.
export default function TeacherForumReportsScreen({ user, onBack, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const [reports, setReports] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')

  function load() {
    getTeacherForumReports()
      .then((data) => setReports(data.reports))
      .catch((err) => setLoadError(getErrorMessage(err, t, 'teacher.loadForumReportsFailed')))
  }

  // t is a stable function for the app's lifetime (see src/lib/i18n.js) —
  // not a real dependency; this effect should only run once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  async function handleResolve(report, action) {
    if (busyId) return
    setActionError('')
    setBusyId(report.id)
    try {
      await resolveTeacherForumReport({ report_id: report.id, action })
      setReports((prev) => prev.filter((r) => r.id !== report.id))
    } catch (err) {
      setActionError(getErrorMessage(err, t, 'teacher.forumReportActionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="screen">
      <TopBar title={t('teacher.forumReportsTitle')} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      {actionError && <p className="form-error">{actionError}</p>}

      {!reports ? (
        !loadError && <p className="loading-text">{t('common.loading')}</p>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-emoji">✅</p>
          <p>{t('teacher.noForumReports')}</p>
        </div>
      ) : (
        <div className="teacher-class-list">
          {reports.map((report) => (
            <div key={report.id} className="teacher-class-card">
              <div className="teacher-class-card-header">
                <p className="teacher-class-name">{report.targetClassLabel}</p>
              </div>
              <p className="teacher-class-detail">{report.contentPreview}</p>
              <p className="teacher-class-detail">{t('teacher.forumReportReasonBy', { reason: report.reason, username: report.reporterUsername })}</p>
              <div className="modal-actions">
                <button type="button" className="btn btn-danger btn-small" disabled={busyId === report.id} onClick={() => handleResolve(report, 'delete')}>
                  {t('teacher.forumReportDelete')}
                </button>
                <button type="button" className="btn btn-secondary btn-small" disabled={busyId === report.id} onClick={() => handleResolve(report, 'dismiss')}>
                  {t('teacher.forumReportDismiss')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loadError && <p className="form-error">{loadError}</p>}
    </div>
  )
}
