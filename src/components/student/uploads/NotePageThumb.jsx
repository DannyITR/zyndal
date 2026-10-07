import { useState } from 'react'

// One tappable page thumbnail for a shared upload's stored image (see
// api/_lib/sharedNotesStorage.js for where image.url comes from). A PDF, or
// an image that fails to load (e.g. its signed URL has since expired), shows
// an icon tile instead of a broken-image glyph — still tappable, so the
// lightbox can offer the PDF link / explain the load failure.
export default function NotePageThumb({ image, label, badge, className = '', onClick }) {
  const [failed, setFailed] = useState(false)
  const isPdf = image.mediaType === 'application/pdf'

  return (
    <button type="button" className={`note-page-thumb ${className}`} onClick={onClick} aria-label={label}>
      {isPdf || failed ? (
        <span className="note-page-thumb-icon">{isPdf ? '📄' : '🖼️'}</span>
      ) : (
        <img src={image.url} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} />
      )}
      {badge && <span className="note-page-thumb-badge">{badge}</span>}
    </button>
  )
}
