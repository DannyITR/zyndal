import { useEffect, useState } from 'react'
import {
  getAdminTeacherClaims,
  resolveAdminTeacherClaim,
  getAdminSchoolChangeRequests,
  resolveAdminSchoolChangeRequest,
  getAdminForumReports,
  resolveAdminForumReport,
} from '../../lib/adminApi'
import AdminRejectClaimModal from './AdminRejectClaimModal'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

// Covers every pending-review queue this admin panel has (teacher class
// claims, student school-change requests, reported forum content) as
// sections of one screen. The first two share the same pending/approved/
// rejected shape and the same generic AdminRejectClaimModal; the forum
// reports section is its own simpler pending/reviewed shape (delete or
// dismiss, no rejection-reason modal needed) but lives here too rather than
// as a separate screen, since this is already the admin's one-stop review
// queue.
export default function AdminApprovalsScreen({ onBack, onLogout }) {
  const [claims, setClaims] = useState(null)
  const [claimsLoadError, setClaimsLoadError] = useState('')
  const [requests, setRequests] = useState(null)
  const [requestsLoadError, setRequestsLoadError] = useState('')
  const [reports, setReports] = useState(null)
  const [reportsLoadError, setReportsLoadError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null) // { type: 'claim' | 'request', item }

  function loadClaims() {
    getAdminTeacherClaims()
      .then((data) => setClaims(data.claims))
      .catch((err) => setClaimsLoadError(err.message || 'Failed to load claims.'))
  }

  function loadRequests() {
    getAdminSchoolChangeRequests()
      .then((data) => setRequests(data.requests))
      .catch((err) => setRequestsLoadError(err.message || 'Failed to load school-change requests.'))
  }

  function loadReports() {
    getAdminForumReports()
      .then((data) => setReports(data.reports))
      .catch((err) => setReportsLoadError(err.message || 'Failed to load forum reports.'))
  }

  useEffect(() => {
    loadClaims()
    loadRequests()
    loadReports()
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

  async function handleApproveClaim(claim) {
    if (busyId) return
    setActionError('')
    setBusyId(claim.id)
    try {
      await resolveAdminTeacherClaim({ claim_id: claim.id, action: 'approve' })
      setClaims((prev) => prev.filter((c) => c.id !== claim.id))
    } catch (err) {
      setActionError(err.message || 'Failed to approve this claim.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRejectClaim(claim, reason) {
    setActionError('')
    setBusyId(claim.id)
    try {
      await resolveAdminTeacherClaim({ claim_id: claim.id, action: 'reject', rejection_reason: reason })
      setClaims((prev) => prev.filter((c) => c.id !== claim.id))
      setRejectTarget(null)
    } catch (err) {
      setActionError(err.message || 'Failed to reject this claim.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleApproveRequest(request) {
    if (busyId) return
    setActionError('')
    setBusyId(request.id)
    try {
      await resolveAdminSchoolChangeRequest({ request_id: request.id, action: 'approve' })
      setRequests((prev) => prev.filter((r) => r.id !== request.id))
    } catch (err) {
      setActionError(err.message || 'Failed to approve this request.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRejectRequest(request, reason) {
    setActionError('')
    setBusyId(request.id)
    try {
      await resolveAdminSchoolChangeRequest({ request_id: request.id, action: 'reject', rejection_reason: reason })
      setRequests((prev) => prev.filter((r) => r.id !== request.id))
      setRejectTarget(null)
    } catch (err) {
      setActionError(err.message || 'Failed to reject this request.')
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
          <h1>Approvals</h1>
        </div>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={onLogout}>
          Log Out
        </button>
      </header>

      {actionError && <p className="admin-error admin-panel">{actionError}</p>}

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Pending Teacher Claims</h2>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Email</th>
                <th>School</th>
                <th>Subject</th>
                <th>Grade</th>
                <th>Course Number</th>
                <th>Class Name</th>
                <th>Bio Link</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims === null && !claimsLoadError && (
                <tr>
                  <td colSpan={10} className="admin-table-empty">
                    Loading…
                  </td>
                </tr>
              )}
              {claimsLoadError && (
                <tr>
                  <td colSpan={10} className="admin-table-empty admin-error">
                    {claimsLoadError}
                  </td>
                </tr>
              )}
              {claims && claims.length === 0 && (
                <tr>
                  <td colSpan={10} className="admin-table-empty">
                    No pending claims.
                  </td>
                </tr>
              )}
              {claims?.map((claim) => (
                <tr key={claim.id}>
                  <td>
                    @{claim.teacherUsername}
                    {claim.teacherDisplayName ? ` (${claim.teacherDisplayName})` : ''}
                  </td>
                  <td>{claim.teacherEmail || '—'}</td>
                  <td>{claim.schoolName}</td>
                  <td>{claim.subject}</td>
                  <td>{claim.grade ?? '—'}</td>
                  <td>{claim.courseNumber}</td>
                  <td>{claim.displayName}</td>
                  <td>
                    <a href={claim.bioLink} target="_blank" rel="noopener noreferrer">
                      View bio
                    </a>
                  </td>
                  <td>{formatDate(claim.submittedAt)}</td>
                  <td className="admin-row-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-small"
                      disabled={busyId === claim.id}
                      onClick={() => handleApproveClaim(claim)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-small admin-btn-danger"
                      disabled={busyId === claim.id}
                      onClick={() => setRejectTarget({ type: 'claim', item: claim })}
                    >
                      Reject
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
          <h2>Pending School Change Requests</h2>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Requested School</th>
                <th>Proof</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests === null && !requestsLoadError && (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
                    Loading…
                  </td>
                </tr>
              )}
              {requestsLoadError && (
                <tr>
                  <td colSpan={6} className="admin-table-empty admin-error">
                    {requestsLoadError}
                  </td>
                </tr>
              )}
              {requests && requests.length === 0 && (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
                    No pending requests.
                  </td>
                </tr>
              )}
              {requests?.map((request) => (
                <tr key={request.id}>
                  <td>
                    @{request.studentUsername}
                    {request.studentDisplayName ? ` (${request.studentDisplayName})` : ''}
                  </td>
                  <td>{request.studentEmail || '—'}</td>
                  <td>{request.requestedSchoolName}</td>
                  <td>
                    <img
                      src={`data:image/jpeg;base64,${request.proofImageBase64}`}
                      alt="Proof"
                      className="admin-proof-thumb"
                    />
                  </td>
                  <td>{formatDate(request.submittedAt)}</td>
                  <td className="admin-row-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn-small"
                      disabled={busyId === request.id}
                      onClick={() => handleApproveRequest(request)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-small admin-btn-danger"
                      disabled={busyId === request.id}
                      onClick={() => setRejectTarget({ type: 'request', item: request })}
                    >
                      Reject
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
                  <td>{report.contentPreview}</td>
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

      {rejectTarget && (
        <AdminRejectClaimModal
          onCancel={() => setRejectTarget(null)}
          onConfirm={(reason) =>
            rejectTarget.type === 'claim' ? handleRejectClaim(rejectTarget.item, reason) : handleRejectRequest(rejectTarget.item, reason)
          }
        />
      )}
    </div>
  )
}
