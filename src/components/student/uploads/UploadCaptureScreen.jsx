import { useEffect, useRef, useState } from 'react'
import { SUBJECTS } from '../../../lib/questions'
import { todayStr } from '../../../lib/streak'
import { validateUploadFile } from '../../../lib/imageUtils'
import { processUploadedDocument } from '../../../lib/ai'
import { saveUpload } from '../../../lib/storage'
import TopBar from '../../shared/TopBar'

const TYPE_LABEL = { test: 'Test', study_material: 'Study Material' }

export default function UploadCaptureScreen({ user, uploadType, lockedSubjectId, onSaved, onBack, onLogout, onLogoClick }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [subjectId, setSubjectId] = useState(lockedSubjectId || 'math')
  const [topic, setTopic] = useState('')
  const [gradeReceived, setGradeReceived] = useState('')
  const [testDate, setTestDate] = useState('')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  const cameraInputRef = useRef(null)
  const libraryInputRef = useRef(null)

  // Revoke the object URL whenever the previewed file changes or the screen unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFileChosen(chosenFile) {
    setError('')
    const validationError = validateUploadFile(chosenFile)
    if (validationError) {
      setError(validationError)
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(chosenFile)
    setPreviewUrl(chosenFile.type === 'application/pdf' ? null : URL.createObjectURL(chosenFile))
  }

  const isTest = uploadType === 'test'
  const canSubmit =
    Boolean(file) &&
    topic.trim() &&
    !processing &&
    (!isTest || (gradeReceived !== '' && Number(gradeReceived) >= 0 && Number(gradeReceived) <= 100 && testDate))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setProcessing(true)
    setError('')
    try {
      const aiResult = await processUploadedDocument({ file, uploadType })
      const saved = await saveUpload({
        userId: user.id,
        documentType: aiResult.document_type || (isTest ? 'test' : 'worksheet'),
        subject: subjectId,
        topic: topic.trim(),
        gradeReceived: isTest ? Math.round(Number(gradeReceived)) : null,
        testDate: isTest ? testDate : null,
        notes: notes.trim() || null,
        aiResult,
      })
      onSaved(saved)
    } catch (err) {
      console.error('[Uploads] processing failed:', err)
      setError(err.message || "Couldn't process this document. Please try again.")
      setProcessing(false)
    }
  }

  return (
    <div className="screen student-screen">
      <TopBar
        title={`📄 Upload ${TYPE_LABEL[uploadType]}`}
        subtitle="Take a photo or choose a file"
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
        onChange={(e) => e.target.files[0] && handleFileChosen(e.target.files[0])}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="upload-hidden-input"
        onChange={(e) => e.target.files[0] && handleFileChosen(e.target.files[0])}
      />

      {!file ? (
        <div className="upload-picker-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={() => cameraInputRef.current.click()}>
            📷 Take Photo
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => libraryInputRef.current.click()}>
            🖼️ Choose File
          </button>
          <p className="field-hint">JPG, PNG, WEBP, or PDF</p>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="upload-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="Upload preview" className="upload-preview-image" />
            ) : (
              <div className="upload-preview-file">
                <span className="upload-preview-file-icon">📄</span>
                <span className="upload-preview-file-name">{file.name}</span>
              </div>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={processing}
              onClick={() => {
                if (previewUrl) URL.revokeObjectURL(previewUrl)
                setFile(null)
                setPreviewUrl(null)
              }}
            >
              Choose a different file
            </button>
          </div>

          <div className="field">
            <label htmlFor="upload-subject">Subject</label>
            {lockedSubjectId ? (
              <p className="field-static">
                {SUBJECTS.find((s) => s.id === lockedSubjectId)?.icon} {SUBJECTS.find((s) => s.id === lockedSubjectId)?.name}
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

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit}>
            {processing ? 'Reading your document… (this can take a minute)' : 'Save Upload'}
          </button>
        </form>
      )}
    </div>
  )
}
