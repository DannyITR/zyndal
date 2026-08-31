import { useEffect, useState } from 'react'
import { getAdminTeacherClaims, resolveAdminTeacherClaim } from '../../lib/adminApi'
import AdminRejectClaimModal from './AdminRejectClaimModal'

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

export default function AdminTeacherClaimsScreen({ onBack, onLogout }) {
  const [claims, setClaims] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [busyClaimId, setBusyClaimId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null) // claim id

  function loadClaims() {
    getAdminTeacherClaims()
      .then((data) => setClaims(data.claims))
      .catch((err) => setLoadError(err.message || 'Failed to load claims.'))
  }

  useEffect(() => {
    loadClaims()
  }, [])

  async function handleApprove(claim) {
    if (busyClaimId) return
    setActionError('')
    setBusyClaimId(claim.id)
    try {
      await resolveAdminTeacherClaim({ claim_id: claim.id, action: 'approve' })
      setClaims((prev) => prev.filter((c) => c.id !== claim.id))
    } catch (err) {
      setActionError(err.message || 'Failed to approve this claim.')
    } finally {
      setBusyClaimId(null)
    }
  }

  async function handleReject(claim, reason) {
    setActionError('')
    setBusyClaimId(claim.id)
    try {
      await resolveAdminTeacherClaim({ claim_id: claim.id, action: 'reject', rejection_reason: reason })
      setClaims((prev) => prev.filter((c) => c.id !== claim.id))
      setRejectTarget(null)
    } catch (err) {
      setActionError(err.message || 'Failed to reject this claim.')
    } finally {
      setBusyClaimId(null)
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <button type="button" className="admin-back-link" onClick={onBack}>
            ← Back to Dashboard
          </button>
          <h1>Teacher Claims</h1>
        </div>
        <button type="button" className="admin-btn admin-btn-secondary" onClick={onLogout}>
          Log Out
        </button>
      </header>

      {actionError && <p className="admin-error admin-panel">{actionError}</p>}

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Pending Claims</h2>
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
              {claims === null && !loadError && (
                <tr>
                  <td colSpan={10} className="admin-table-empty">
                    Loading…
                  </td>
                </tr>
              )}
              {loadError && (
                <tr>
                  <td colSpan={10} className="admin-table-empty admin-error">
                    {loadError}
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
                      disabled={busyClaimId === claim.id}
                      onClick={() => handleApprove(claim)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-small admin-btn-danger"
                      disabled={busyClaimId === claim.id}
                      onClick={() => setRejectTarget(claim)}
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

      {rejectTarget && (
        <AdminRejectClaimModal onCancel={() => setRejectTarget(null)} onConfirm={(reason) => handleReject(rejectTarget, reason)} />
      )}
    </div>
  )
}
