import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSubject } from '../../../lib/questions'
import { getUploadsForUser, deleteUpload } from '../../../lib/storage'
import { formatShortDate } from '../../../lib/uploads'
import TopBar from '../../shared/TopBar'
import ConfirmDeleteContentModal from '../../shared/forum/ConfirmDeleteContentModal'
import GradeBadge from './GradeBadge'

const DOCUMENT_TYPE_ICON = { test: '📝', worksheet: '📋', textbook: '📖', notes: '🗒️' }

export default function UploadsLibraryScreen({ user, lockedSubjectId, onSelectUpload, onAddPages, onNewUpload, onBack, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const [uploads, setUploads] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Soft delete (see api/uploads/delete-upload.js) — for an upload that was
  // also shared to a Notes Calendar, this removes it there for the whole
  // class too, hence the different warning text.
  async function handleDelete() {
    await deleteUpload(confirmDelete.id)
    setUploads((prev) => prev.filter((u) => u.id !== confirmDelete.id))
    setConfirmDelete(null)
  }

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
        subscriptionStatus={user.subscription_status}
        daysRemainingInTrial={user.days_remaining_in_trial}
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
            const pagesCount = upload.pages_count || 1
            return (
              <li key={upload.id} className="history-item">
                <button type="button" className="history-item-row" onClick={() => onSelectUpload(upload.id)}>
                  <span className="history-icon">{DOCUMENT_TYPE_ICON[upload.document_type] || '📄'}</span>
                  <div className="history-body">
                    <p className="history-prompt">
                      {subject?.icon || ''} {subject?.name || upload.subject} — {upload.topic}
                    </p>
                    <p className="history-meta">
                      Created {formatShortDate(upload.created_at)} · {pagesCount} page{pagesCount === 1 ? '' : 's'}
                      {upload.updated_at && ` · Updated ${formatShortDate(upload.updated_at)}`}
                    </p>
                  </div>
                  {upload.grade_received != null && <GradeBadge grade={upload.grade_received} />}
                  <span className="history-chevron">›</span>
                </button>
                <div className="upload-item-actions">
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => onAddPages(upload)}>
                    + Add Pages
                  </button>
                  <button type="button" className="btn btn-danger-outline btn-small" onClick={() => setConfirmDelete(upload)}>
                    {t('forum.delete')}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {confirmDelete && (
        <ConfirmDeleteContentModal
          titleKey="uploads.deleteUploadTitle"
          warningKey={confirmDelete.shared_class_id ? 'uploads.deleteSharedUploadWarning' : 'uploads.deleteUploadWarning'}
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
