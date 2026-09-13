import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSubject } from '../../../lib/questions'
import { getUploadDetail } from '../../../lib/storage'
import { formatLongDate } from '../../../lib/streak'
import { getErrorMessage } from '../../../lib/errors'
import TopBar from '../../shared/TopBar'
import UploadDetailScreen from '../uploads/UploadDetailScreen'

const DOCUMENT_TYPE_ICON = { test: '📝', worksheet: '📋', textbook: '📖', notes: '🗒️' }

// Structural sibling of HomeworkDetailScreen.jsx — lists a day's shared
// uploads using the same .history-list/.history-item classes
// UploadsLibraryScreen.jsx already uses (so a shared upload looks exactly
// like it does in My Uploads, per spec), and swaps to the existing
// UploadDetailScreen in place when one is tapped, self-contained the same
// way HomeworkDetailScreen's AssignmentAnswers fetch-on-tap is.
//
// onUploadForDay: opens the upload flow pre-locked to this exact day (see
// UploadCaptureScreen.jsx's presetSharedForDate) — shown regardless of
// whether this day already has uploads, since a student catching up (or
// adding a second set of notes) should be able to add more either way.
export default function GroupUploadsDayDetailScreen({ user, date, uploads, onUploadForDay, onBack, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const [viewingUpload, setViewingUpload] = useState(null)
  const [loadingId, setLoadingId] = useState(null)
  const [error, setError] = useState('')

  async function handleView(uploadId) {
    setError('')
    setLoadingId(uploadId)
    try {
      const detail = await getUploadDetail(uploadId)
      setViewingUpload(detail)
    } catch (err) {
      setError(getErrorMessage(err, t))
    } finally {
      setLoadingId(null)
    }
  }

  if (viewingUpload) {
    return <UploadDetailScreen user={user} upload={viewingUpload} onBack={() => setViewingUpload(null)} onLogout={onLogout} onLogoClick={onLogoClick} />
  }

  return (
    <div className="screen student-screen">
      <TopBar title={formatLongDate(date)} subtitle={t('groupUploads.dayDetailSubtitle')} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      <button type="button" className="btn btn-primary btn-block" onClick={onUploadForDay}>
        {t('groupUploads.uploadForDayButton')}
      </button>

      {error && <p className="form-error">{error}</p>}

      {uploads.length === 0 ? (
        <p className="field-hint">{t('groupUploads.emptyDay')}</p>
      ) : (
        <ul className="history-list">
          {uploads.map((upload) => {
            const subject = getSubject(upload.subject)
            return (
              <li key={upload.id} className="history-item">
                <button type="button" className="history-item-row" disabled={loadingId === upload.id} onClick={() => handleView(upload.id)}>
                  <span className="history-icon">{DOCUMENT_TYPE_ICON[upload.documentType] || '📄'}</span>
                  <div className="history-body">
                    <p className="history-prompt">
                      {subject?.icon || ''} {subject?.name || upload.subject} — {upload.topic}
                    </p>
                    <p className="history-meta">
                      {t('groupUploads.uploadedBy', { username: upload.uploaderUsername || '—' })}
                      {' · '}
                      {upload.pagesCount} {upload.pagesCount === 1 ? t('groupUploads.page') : t('groupUploads.pages')}
                    </p>
                  </div>
                  <span className="history-chevron">{loadingId === upload.id ? '…' : '›'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
