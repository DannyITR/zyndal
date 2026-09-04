import { useEffect, useState } from 'react'
import { getAdminForumReports, resolveAdminForumReport, getAdminMessageReports, resolveAdminMessageReport } from '../../lib/adminApi'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

const MESSAGE_CATEGORY_LABELS = {
  self_harm: '🚨 Self-Harm',
  sexual_content_minors: '⚠️ Sexual Content (Minor)',
  threats: '⚠️ Threat',
}

function MessageFlagBadge({ report }) {
  if (report.source !== 'ai') return <span className="admin-flag-badge admin-flag-badge--user">User Report</span>
  const label = MESSAGE_CATEGORY_LABELS[report.category] || 'AI Flag'
  const urgent = report.category === 'self_harm'
  return <span className={`admin-flag-badge admin-flag-badge--ai ${urgent ? 'admin-flag-badge--urgent' : ''}`}>{label}</span>
}

// Dedicated moderation queue — separate from AdminApprovalsScreen.jsx
// (teacher claims, school-change requests), which is its own distinct
// approval flow (pending/approved/rejected with a rejection-reason modal).
// This screen is purely "review flagged content, delete or dismiss" —
// forum reports and private-message reports (including AI-flagged rows,
// source = 'ai', already sorted self-harm-first server-side — see
// api/admin/get-message-reports.js).
export default function AdminReportsScreen({ onBack, onLogout, onMessageUser }) {
  const [reports, setReports] = useState(null)
  const [reportsLoadError, setReportsLoadError] = useState('')
  const [messageReports, setMessageReports] = useState(null)
  const [messageReportsLoadError, setMessageReportsLoadError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')

  function loadReports() {
    getAdminForumReports()
      .then((data) => setReports(data.reports))
      .catch((err) => setReportsLoadError(err.message || 'Failed to load forum reports.'))
  }

  function loadMessageReports() {
    getAdminMessageReports()
      .then((data) => setMessageReports(data.reports))
      .catch((err) => setMessageReportsLoadError(err.message || 'Failed to load message reports.'))
  }

  useEffect(() => {
    loadReports()
    loadMessageReports()
  }, [])

  async function handleDeleteReport(report) {
    if (busyId) return
    setActionError('')
    setBusyId(report.id)
    try {
      await resolveAdminForumReport({ report_id: report.id, action: 'delete' })
      setReports((prev) => prev.filter((r) => r.id !== report.id))
    } catch (err) {
      setActionError(err.message || 'Failed to delete this content.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDismissReport(report) {
    if (busyId) return
    setActionError('')
    setBusyId(report.id)
    try {
      await resolveAdminForumReport({ report_id: report.id, action: 'dismiss' })
      setReports((prev) => prev.filter((r) => r.id !== report.id))
    } catch (err) {
      setActionError(err.message || 'Failed to dismiss this report.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeleteMessageReport(report) {
    if (busyId) return
    setActionError('')
    setBusyId(report.id)
    try {
      await resolveAdminMessageReport({ report_id: report.id, action: 'delete' })
      setMessageReports((prev) => prev.filter((r) => r.id !== report.id))
    } catch (err) {
      setActionError(err.message || 'Failed to delete this message.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDismissMessageReport(report) {
    if (busyId) return
    setActionError('')
    setBusyId(report.id)
    try {
      await resolveAdminMessageReport({ report_id: report.id, action: 'dismiss' })
      setMessageReports((prev) => prev.filter((r) => r.id !== report.id))
    } catch (err) {
      setActionError(err.message || 'Failed to dismiss this report.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <button type="button" className="admin-back-link" onClick={onBack}>
            ← Back to Dashboard
          </button>
          <h1>Reports</h1>
        </div>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={onLogout}>
          Log Out
        </button>
      </header>

      {actionError && <p className="admin-error admin-panel">{actionError}</p>}

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Reported Forum Content</h2>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Content</th>
                <th>Class</th>
                <th>Reporter</th>
                <th>Reason</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports === null && !reportsLoadError && (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    Loading…
                  </td>
                </tr>
              )}
              {reportsLoadError && (
                <tr>
                  <td colSpan={7} className="admin-table-empty admin-error">
                    {reportsLoadError}
                  </td>
                </tr>
              )}
              {reports && reports.length === 0 && (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    No pending reports.
                  </td>
                </tr>
              )}
              {reports?.map((report) => (
                <tr key={report.id}>
                  <td>{report.targetType === 'thread' ? 'Thread' : 'Reply'}</td>
                  <td>
                    {report.contentPreview}
                    {report.deletedByAuthor && <span className="admin-deleted-tag"> Deleted by author</span>}
                  </td>
                  <td>{report.targetClassLabel}</td>
                  <td>@{report.reporterUsername}</td>
                  <td>{report.reason}</td>
                  <td>{formatDate(report.submittedAt)}</td>
                  <td className="admin-row-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-small admin-btn-danger"
                      disabled={busyId === report.id}
                      onClick={() => handleDeleteReport(report)}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-small"
                      disabled={busyId === report.id}
                      onClick={() => handleDismissReport(report)}
                    >
                      Dismiss
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Reported Private Messages</h2>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Flag</th>
                <th>Sender</th>
                <th>Content</th>
                <th>Reporter</th>
                <th>Reason</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {messageReports === null && !messageReportsLoadError && (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    Loading…
                  </td>
                </tr>
              )}
              {messageReportsLoadError && (
                <tr>
                  <td colSpan={7} className="admin-table-empty admin-error">
                    {messageReportsLoadError}
                  </td>
                </tr>
              )}
              {messageReports && messageReports.length === 0 && (
                <tr>
                  <td colSpan={7} className="admin-table-empty">
                    No pending reports.
                  </td>
                </tr>
              )}
              {messageReports?.map((report) => (
                <tr key={report.id} className={report.category === 'self_harm' ? 'admin-row-urgent' : ''}>
                  <td>
                    <MessageFlagBadge report={report} />
                  </td>
                  <td>@{report.senderUsername}</td>
                  <td>{report.contentPreview}</td>
                  <td>{report.reporterUsername ? `@${report.reporterUsername}` : 'AI Screening'}</td>
                  <td>{report.reason}</td>
                  <td>{formatDate(report.submittedAt)}</td>
                  <td className="admin-row-actions">
                    {report.senderId && (
                      <button type="button" className="admin-btn admin-btn-small" onClick={() => onMessageUser(report.senderId)}>
                        Message Sender
                      </button>
                    )}
                    <button
                      type="button"
                      className="admin-btn admin-btn-small admin-btn-danger"
                      disabled={busyId === report.id}
                      onClick={() => handleDeleteMessageReport(report)}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-small"
                      disabled={busyId === report.id}
                      onClick={() => handleDismissMessageReport(report)}
                    >
                      Dismiss
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
