import { useEffect, useState } from 'react'
import { getSubject } from '../../../lib/questions'
import { getUploadsForUser } from '../../../lib/storage'
import TopBar from '../../shared/TopBar'
import GradeBadge from './GradeBadge'

const DOCUMENT_TYPE_ICON = { test: '📝', worksheet: '📋', textbook: '📖', notes: '🗒️' }

export default function UploadsLibraryScreen({ user, lockedSubjectId, onSelectUpload, onNewUpload, onBack, onLogout, onLogoClick }) {
  const [uploads, setUploads] = useState(null)

  useEffect(() => {
    let cancelled = false
    getUploadsForUser(user.id).then((list) => {
      if (!cancelled) setUploads(list)
    })
    return () => {
      cancelled = true
    }
  }, [user.id])

  const filteredUploads = uploads
    ? lockedSubjectId
      ? uploads.filter((u) => u.subject === lockedSubjectId)
      : uploads
    : null

  return (
    <div className="screen student-screen">
      <TopBar
        title="🗂️ My Uploads"
        subtitle="Everything you've scanned"
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <button type="button" className="btn btn-primary btn-block" onClick={onNewUpload}>
        + New Upload
      </button>

      {!filteredUploads ? (
        <p className="loading-text">Loading your uploads…</p>
      ) : filteredUploads.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-emoji">📄</p>
          <p>No uploads yet.</p>
          <p className="field-hint">Photograph a test or worksheet to get started.</p>
        </div>
      ) : (
        <ul className="history-list">
          {filteredUploads.map((upload) => {
            const subject = getSubject(upload.subject)
            return (
              <li key={upload.id} className="history-item">
                <button type="button" className="history-item-row" onClick={() => onSelectUpload(upload.id)}>
                  <span className="history-icon">{DOCUMENT_TYPE_ICON[upload.document_type] || '📄'}</span>
                  <div className="history-body">
                    <p className="history-prompt">
                      {subject?.icon || ''} {subject?.name || upload.subject} — {upload.topic}
                    </p>
                    <p className="history-meta">
                      {upload.created_at.slice(0, 10)} · {upload.document_type}
                    </p>
                  </div>
                  {upload.grade_received != null && <GradeBadge grade={upload.grade_received} />}
                  <span className="history-chevron">›</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
