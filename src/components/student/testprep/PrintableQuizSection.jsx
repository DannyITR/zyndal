import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import StudyQuizModal from './StudyQuizModal'

// The "Printable quizzes" section — a checkbox per upload, one button that
// opens the printable quiz preview (StudyQuizModal) for the ticked ones, and
// the success toast after an email goes out. Shared by the Study Guide (the
// student's own uploads for a subject) and a Notes Calendar day (that day's
// shared uploads, see GroupUploadsDayDetailScreen.jsx). Renders nothing when
// there are no uploads to offer.
//
// uploads: [{ uploadId, topic, meta? }] — meta is an optional second line
// under the topic (the calendar shows who shared it). Nothing starts ticked.
// hint: the line under the heading, since "your uploads" only fits the
// Study Guide.
// selection / onSelectionChange: optional — pass both to track the ticked
// upload ids yourself. The Study Guide does, so the same ticks also choose
// which uploads its practice draws from.
export default function PrintableQuizSection({ uploads, accountEmail, hint, disabled = false, selection: controlledSelection, onSelectionChange }) {
  const { t } = useTranslation()
  const [ownSelection, setOwnSelection] = useState([]) // ticked upload ids, when the parent doesn't track them
  const selection = controlledSelection ?? ownSelection
  const setSelection = (update) => {
    const next = typeof update === 'function' ? update(selection) : update
    if (onSelectionChange) onSelectionChange(next)
    else setOwnSelection(next)
  }
  const [quizPackage, setQuizPackage] = useState(null) // the uploads whose quiz is being previewed
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(toastTimerRef.current), [])

  // Only uploads still on offer count as selected — the list can shrink
  // under the section (a calendar upload deleted by its owner).
  const selected = uploads.filter((upload) => selection.includes(upload.uploadId))

  function toggle(uploadId) {
    setSelection((prev) => (prev.includes(uploadId) ? prev.filter((id) => id !== uploadId) : [...prev, uploadId]))
  }

  function handleSent(sentTo) {
    setQuizPackage(null)
    setToast(t('studyQuiz.sentToast', { email: sentTo }))
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 4000)
  }

  if (uploads.length === 0) return null

  return (
    <>
      <section className="study-quiz-list">
        <h3 className="study-quiz-list-title">{t('studyQuiz.sectionTitle')}</h3>
        <p className="field-hint">{hint}</p>
        {uploads.map((upload) => (
          <label key={upload.uploadId} className="study-quiz-row">
            <input type="checkbox" checked={selection.includes(upload.uploadId)} disabled={disabled} onChange={() => toggle(upload.uploadId)} />
            <span className="study-quiz-row-text">
              <span className="study-quiz-row-topic">{upload.topic}</span>
              {upload.meta && <span className="study-quiz-row-meta">{upload.meta}</span>}
            </span>
          </label>
        ))}
        <button type="button" className="btn btn-secondary btn-block" disabled={disabled || selected.length === 0} onClick={() => setQuizPackage(selected)}>
          🖨️ {selected.length > 0 ? t('studyQuiz.printableQuizSelected', { count: selected.length }) : t('studyQuiz.printableQuiz')}
        </button>
      </section>
      {quizPackage && <StudyQuizModal uploads={quizPackage} accountEmail={accountEmail} onSent={handleSent} onClose={() => setQuizPackage(null)} />}
      {toast && (
        <div className="app-toast app-toast--success" role="status">
          {toast}
        </div>
      )}
    </>
  )
}
