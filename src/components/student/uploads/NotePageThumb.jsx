import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// One tappable page thumbnail for a shared upload's stored image (see
// api/_lib/sharedNotesStorage.js for where image.url comes from). A PDF
// shows an icon tile (still tappable, so the lightbox can offer its link).
//
// An image that fails to load never just disappears: the tile switches to a
// visible "retry" state, and tapping it re-requests the image (by
// remounting the <img>) instead of opening the viewer on a page that
// wouldn't load there either.
//
// No loading="lazy" here on purpose — a day's list is a handful of small
// tiles, and lazy loading is one more way for a thumbnail inside a <button>
// to never start loading on iOS Safari (see .note-page-thumb img in
// App.css for the other one).
export default function NotePageThumb({ image, label, badge, className = '', onClick }) {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const isPdf = image.mediaType === 'application/pdf'

  function handleClick() {
    if (failed) {
      setFailed(false)
      setAttempt((n) => n + 1)
      return
    }
    onClick()
  }

  return (
    <button type="button" className={`note-page-thumb ${className}`} onClick={handleClick} aria-label={failed ? t('groupUploads.retryImage') : label}>
      {isPdf ? (
        <span className="note-page-thumb-icon">📄</span>
      ) : failed ? (
        <span className="note-page-thumb-icon note-page-thumb-icon--retry">
          🖼️
          <span className="note-page-thumb-retry">↻ {t('groupUploads.retryImageShort')}</span>
        </span>
      ) : (
        <img key={attempt} src={image.url} alt="" decoding="async" draggable={false} onError={() => setFailed(true)} />
      )}
      {badge && !failed && <span className="note-page-thumb-badge">{badge}</span>}
    </button>
  )
}
