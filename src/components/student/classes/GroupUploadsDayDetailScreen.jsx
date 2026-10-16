import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSubject } from '../../../lib/questions'
import { getUploadDetail, deleteUpload } from '../../../lib/storage'
import { formatLongDate } from '../../../lib/streak'
import { getErrorMessage } from '../../../lib/errors'
import TopBar from '../../shared/TopBar'
import ImageLightbox from '../../shared/ImageLightbox'
import ConfirmDeleteContentModal from '../../shared/forum/ConfirmDeleteContentModal'
import UploadDetailScreen from '../uploads/UploadDetailScreen'
import NotePageThumb from '../uploads/NotePageThumb'
import PrintableQuizSection from '../testprep/PrintableQuizSection'

const DOCUMENT_TYPE_ICON = { test: '📝', worksheet: '📋', textbook: '📖', notes: '🗒️' }

// "Show only my notes" is remembered per browser, for every class and day,
// so a student who prefers their own notes doesn't re-pick it each visit.
// Storage can be unavailable (private mode, blocked site data), so every
// access is wrapped and falls back to showing all notes.
const MINE_ONLY_STORAGE_KEY = 'zyndal_notes_calendar_mine_only'

function readMineOnly() {
  try {
    return localStorage.getItem(MINE_ONLY_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeMineOnly(value) {
  try {
    localStorage.setItem(MINE_ONLY_STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Best-effort — the choice just won't be remembered next visit.
  }
}

// Structural sibling of HomeworkDetailScreen.jsx — lists a day's shared
// uploads using the same .history-list/.history-item classes
// UploadsLibraryScreen.jsx already uses (so a shared upload looks exactly
// like it does in My Uploads, per spec), and swaps to the existing
// UploadDetailScreen in place when one is tapped, self-contained the same
// way HomeworkDetailScreen's AssignmentAnswers fetch-on-tap is.
//
// Each row also carries the upload's actual page images (upload.images —
// signed URLs the calendar endpoint only hands to confirmed members of the
// class): the first page shows as a thumbnail that opens the full-size
// viewer directly, next to a preview of the AI summary, so a student can
// read the real notes without the summary ever being hidden. Uploads shared
// before page images were stored have an empty images list and keep the
// plain document-type icon.
//
// A student's own uploads (upload.isOwn) also get a delete button. It's a
// soft delete (see api/uploads/delete-upload.js): the notes vanish
// for the whole class, tracked locally in deletedIds since `uploads` is a
// snapshot handed down from the calendar, which refetches on its own the
// next time it's shown.
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
  const [lightbox, setLightbox] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deletedIds, setDeletedIds] = useState([])
  const [mineOnly, setMineOnly] = useState(readMineOnly)
  const dayUploads = uploads.filter((u) => !deletedIds.includes(u.id))
  const myCount = dayUploads.filter((u) => u.isOwn).length
  // "Show only my notes" filters both the list and the printable-quiz
  // checkboxes below it, so a ticked classmate's upload can't end up in a
  // quiz while hidden.
  const visibleUploads = mineOnly ? dayUploads.filter((u) => u.isOwn) : dayUploads

  function chooseMineOnly(value) {
    setMineOnly(value)
    writeMineOnly(value)
  }

  // The day's study-material uploads (classmates' as well as the student's
  // own, unless filtered) for the same "Printable quizzes" section the Study
  // Guide shows — never a graded test, and hidden entirely when there are
  // none.
  const quizUploads = visibleUploads
    .filter((u) => u.documentType !== 'test')
    .map((u) => ({ uploadId: u.id, topic: u.topic, meta: t('groupUploads.uploadedBy', { username: u.uploaderUsername || '—' }) }))

  async function handleDelete() {
    await deleteUpload(confirmDeleteId)
    setDeletedIds((prev) => [...prev, confirmDeleteId])
    setConfirmDeleteId(null)
  }

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

      {dayUploads.length > 0 && (
        <div className="segmented-toggle" role="group" aria-label={t('groupUploads.notesFilterLabel')}>
          <button
            type="button"
            className={`segmented-toggle-btn ${mineOnly ? 'segmented-toggle-btn--active' : ''}`}
            aria-pressed={mineOnly}
            onClick={() => chooseMineOnly(true)}
          >
            {t('groupUploads.filterMine', { count: myCount })}
          </button>
          <button
            type="button"
            className={`segmented-toggle-btn ${!mineOnly ? 'segmented-toggle-btn--active' : ''}`}
            aria-pressed={!mineOnly}
            onClick={() => chooseMineOnly(false)}
          >
            {t('groupUploads.filterAll', { count: dayUploads.length })}
          </button>
        </div>
      )}

      {dayUploads.length === 0 ? (
        <p className="field-hint">{t('groupUploads.emptyDay')}</p>
      ) : visibleUploads.length === 0 ? (
        <p className="field-hint">{t('groupUploads.noMyNotesDay')}</p>
      ) : (
        <ul className="history-list">
          {visibleUploads.map((upload) => {
            const subject = getSubject(upload.subject)
            const images = upload.images || []
            const heading = `${subject?.name || upload.subject} — ${upload.topic}`
            return (
              <li key={upload.id} className="history-item shared-note-item">
                {images.length > 0 && (
                  <NotePageThumb
                    image={images[0]}
                    className="shared-note-thumb"
                    label={t('groupUploads.viewPhotos', { count: images.length })}
                    badge={images.length > 1 ? `1/${images.length}` : null}
                    onClick={() => setLightbox({ images, title: heading })}
                  />
                )}
                <button type="button" className="history-item-row" disabled={loadingId === upload.id} onClick={() => handleView(upload.id)}>
                  {images.length === 0 && <span className="history-icon">{DOCUMENT_TYPE_ICON[upload.documentType] || '📄'}</span>}
                  <div className="history-body">
                    <p className="history-prompt">
                      {subject?.icon || ''} {heading}
                    </p>
                    {upload.summary && <p className="shared-note-summary">{upload.summary}</p>}
                    <p className="history-meta">
                      {t('groupUploads.uploadedBy', { username: upload.uploaderUsername || '—' })}
                      {' · '}
                      {upload.pagesCount} {upload.pagesCount === 1 ? t('groupUploads.page') : t('groupUploads.pages')}
                    </p>
                  </div>
                  <span className="history-chevron">{loadingId === upload.id ? '…' : '›'}</span>
                </button>
                {upload.isOwn && (
                  <button type="button" className="shared-note-delete" onClick={() => setConfirmDeleteId(upload.id)} aria-label={t('groupUploads.deleteNotes')}>
                    🗑️
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <PrintableQuizSection uploads={quizUploads} accountEmail={user.email} hint={t('studyQuiz.calendarSectionHint')} />

      {confirmDeleteId && (
        <ConfirmDeleteContentModal
          titleKey="groupUploads.deleteNotesTitle"
          warningKey="groupUploads.deleteNotesWarning"
          onConfirm={handleDelete}
          onClose={() => setConfirmDeleteId(null)}
        />
      )}

      {lightbox && <ImageLightbox images={lightbox.images} title={lightbox.title} onClose={() => setLightbox(null)} />}
    </div>
  )
}
