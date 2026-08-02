import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SUBJECTS, getSubject } from '../../../lib/questions'
import { todayStr } from '../../../lib/streak'
import { validateUploadFile } from '../../../lib/imageUtils'
import { MAX_UPLOAD_PAGES } from '../../../lib/uploads'
import { processUploadedDocument } from '../../../lib/ai'
import { saveUpload, addPagesToUpload, getUploadDetail } from '../../../lib/storage'
import { getErrorMessage } from '../../../lib/errors'
import TopBar from '../../shared/TopBar'

const TYPE_LABEL = { test: 'Test', study_material: 'Study Material' }

// existingUpload: when set, this screen is in "Add Pages" mode — no subject
// / topic / grade fields (those already exist on the upload), just capture
// more pages and merge their extracted questions into the same upload.
export default function UploadCaptureScreen({ user, uploadType, lockedSubjectId, existingUpload, onSaved, onBack, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const [pages, setPages] = useState([]) // [{ id, file, previewUrl }]
  const [subjectId, setSubjectId] = useState(lockedSubjectId || 'math')
  const [topic, setTopic] = useState('')
  const [gradeReceived, setGradeReceived] = useState('')
  const [testDate, setTestDate] = useState('')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const cameraInputRef = useRef(null)
  const libraryInputRef = useRef(null)

  // Revoke every page's object URL on unmount.
  useEffect(() => {
    return () => {
      pages.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addFiles(fileList) {
    setError('')
    const incoming = Array.from(fileList)
    const remainingSlots = MAX_UPLOAD_PAGES - pages.length
    const accepted = []
    let skipped = 0

    for (const file of incoming) {
      if (accepted.length >= remainingSlots) {
        skipped++
        continue
      }
      const validationError = validateUploadFile(file)
      if (validationError) {
        setError(validationError)
        continue
      }
      accepted.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        previewUrl: file.type === 'application/pdf' ? null : URL.createObjectURL(file),
      })
    }

    if (accepted.length > 0) setPages((prev) => [...prev, ...accepted])
    if (skipped > 0) setError(`Only ${MAX_UPLOAD_PAGES} pages allowed per upload — ${skipped} file${skipped === 1 ? '' : 's'} not added.`)
  }

  function removePage(id) {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  const isTest = uploadType === 'test'
  const isAddingPages = Boolean(existingUpload)
  const canSubmit =
    pages.length > 0 &&
    !processing &&
    (isAddingPages || (topic.trim() && (!isTest || (gradeReceived !== '' && Number(gradeReceived) >= 0 && Number(gradeReceived) <= 100 && testDate))))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setProcessing(true)
    setError('')
    try {
      const files = pages.map((p) => p.file)
      const aiResult = await processUploadedDocument({ files, uploadType })

      if (isAddingPages) {
        await addPagesToUpload({ uploadId: existingUpload.id, questions: aiResult.questions, pagesAdded: files.length })
        const refreshed = await getUploadDetail(existingUpload.id)
        onSaved(refreshed)
      } else {
        const saved = await saveUpload({
          userId: user.id,
          documentType: aiResult.document_type || (isTest ? 'test' : 'worksheet'),
          subject: subjectId,
          topic: topic.trim(),
          gradeReceived: isTest ? Math.round(Number(gradeReceived)) : null,
          testDate: isTest ? testDate : null,
          notes: notes.trim() || null,
          aiResult,
          pagesCount: files.length,
        })
        onSaved(saved)
      }
    } catch (err) {
      console.error('[Uploads] processing failed:', err)
      setError(getErrorMessage(err, t))
      setProcessing(false)
    }
  }

  const canAddMore = pages.length < MAX_UPLOAD_PAGES

  return (
    <div className="screen student-screen">
      <TopBar
        title={isAddingPages ? '📄 Add Pages' : `📄 Upload ${TYPE_LABEL[uploadType]}`}
        subtitle={isAddingPages ? `${existingUpload.topic}` : 'Take a photo or choose a file'}
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="upload-hidden-input"
        onChange={(e) => {
          if (e.target.files.length) addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        multiple
        className="upload-hidden-input"
        onChange={(e) => {
          if (e.target.files.length) addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="upload-pages-counter">
          {pages.length}/{MAX_UPLOAD_PAGES} pages selected
        </p>

        {pages.length > 0 && (
          <div className="upload-pages-grid">
            {pages.map((page, i) => (
              <div key={page.id} className="upload-page-thumb">
                {page.previewUrl ? (
                  <img src={page.previewUrl} alt={`Page ${i + 1}`} />
                ) : (
                  <div className="upload-page-thumb-file">
                    <span className="upload-preview-file-icon">📄</span>
                    <span className="upload-preview-file-name">{page.file.name}</span>
                  </div>
                )}
                <span className="upload-page-number">{i + 1}</span>
                <button
                  type="button"
                  className="upload-page-remove"
                  disabled={processing}
                  onClick={() => removePage(page.id)}
                  aria-label={`Remove page ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {canAddMore && (
          <div className="upload-picker-actions">
            <button type="button" className="btn btn-primary btn-block" disabled={processing} onClick={() => cameraInputRef.current.click()}>
              📷 {pages.length === 0 ? 'Take Photo' : 'Take Another Photo'}
            </button>
            <button type="button" className="btn btn-secondary btn-block" disabled={processing} onClick={() => libraryInputRef.current.click()}>
              🖼️ Choose File{pages.length === 0 ? 's' : ' / Add More'}
            </button>
            <p className="field-hint">JPG, PNG, WEBP, or PDF — up to {MAX_UPLOAD_PAGES} pages</p>
          </div>
        )}

        {!isAddingPages && (
          <>
            <div className="field">
              <label htmlFor="upload-subject">Subject</label>
              {lockedSubjectId ? (
                <p className="field-static">
                  {getSubject(lockedSubjectId)?.icon} {getSubject(lockedSubjectId)?.name}
                </p>
              ) : (
                <select id="upload-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  {SUBJECTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="field">
              <label htmlFor="upload-topic">Topic / Chapter</label>
              <input
                id="upload-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Quadratic equations"
              />
            </div>

            {isTest && (
              <>
                <div className="field">
                  <label htmlFor="upload-grade">Grade received (%)</label>
                  <input
                    id="upload-grade"
                    type="number"
                    min="0"
                    max="100"
                    value={gradeReceived}
                    onChange={(e) => setGradeReceived(e.target.value)}
                    placeholder="e.g. 78"
                  />
                </div>
                <div className="field">
                  <label htmlFor="upload-test-date">Test date</label>
                  <input
                    id="upload-test-date"
                    type="date"
                    max={todayStr()}
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="field">
              <label htmlFor="upload-notes">Notes (optional)</label>
              <textarea
                id="upload-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything you want to remember about this one"
              />
            </div>
          </>
        )}

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit}>
          {processing ? 'Reading your document… (this can take a minute)' : isAddingPages ? 'Add Pages' : 'Save Upload'}
        </button>
      </form>
    </div>
  )
}
