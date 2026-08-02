import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createHomework, getBankQuestions } from '../../lib/storage'
import { processUploadedDocument } from '../../lib/ai'
import { validateUploadFile } from '../../lib/imageUtils'
import { SUBJECTS } from '../../lib/questions'
import TopBar from '../shared/TopBar'

const GRADES = [7, 8, 9, 10, 11]

// Always scoped to the one class the teacher opened this from (see
// ClassDetailScreen's "Assign Homework" button) — no more class multi-select,
// per the decision to move this screen from a top-level teacher-home action
// into each class's own detail page.
export default function AssignHomeworkScreen({ user, classId, className, onBack, onLogout, onLogoClick, onCreated }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState('upload') // upload | bank
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState(SUBJECTS[0].id)
  const [dueDate, setDueDate] = useState('')

  // Tab 1: from an uploaded photo/PDF — reuses the exact same Claude
  // vision extraction the student upload flow uses (generate-from-document.js
  // via processUploadedDocument), then converts its
  // {question, correct_answer, options, explanation, difficulty} shape into
  // this app's standard {question, options, correct (index), explanation}
  // shape. A source question with fewer/more than 4 options, or whose
  // correct_answer text doesn't exactly match one of its own options, can't
  // be represented that way — it's skipped (counted, not silently dropped)
  // rather than guessing.
  const [files, setFiles] = useState([])
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [skippedCount, setSkippedCount] = useState(0)
  const [questions, setQuestions] = useState([])

  // Tab 2: from the question bank (generated_questions)
  const [bankGrade, setBankGrade] = useState('9')
  const [bankQuestions, setBankQuestions] = useState(null)
  const [bankLoading, setBankLoading] = useState(false)
  const [bankError, setBankError] = useState('')
  const [selectedBankIds, setSelectedBankIds] = useState(new Set())
  const [randomCount, setRandomCount] = useState('5')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function handleFilesSelected(e) {
    const selected = Array.from(e.target.files || [])
    const validationError = selected.map(validateUploadFile).find(Boolean)
    if (validationError) {
      setExtractError(validationError)
      return
    }
    setFiles(selected)
    setExtractError('')
  }

  async function handleExtract() {
    if (files.length === 0) {
      setExtractError(t('teacher.chooseFileFirst'))
      return
    }
    setExtracting(true)
    setExtractError('')
    try {
      const result = await processUploadedDocument({ files, uploadType: 'test' })
      const raw = result.questions || []
      const converted = []
      let skipped = 0
      for (const q of raw) {
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          skipped++
          continue
        }
        const correctIndex = q.options.indexOf(q.correct_answer)
        if (correctIndex < 0) {
          skipped++
          continue
        }
        converted.push({ question: q.question, options: q.options, correct: correctIndex, explanation: q.explanation })
      }
      setSkippedCount(skipped)
      setQuestions(converted)

      const matchedSubject = SUBJECTS.find((s) => s.name.toLowerCase() === String(result.subject).toLowerCase())
      if (matchedSubject) setSubject(matchedSubject.id)
      if (!title && result.topic) setTitle(result.topic)
    } catch (err) {
      setExtractError(err.message || t('teacher.readDocumentFailed'))
    } finally {
      setExtracting(false)
    }
  }

  function updateQuestionField(index, field, value) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)))
  }
  function updateQuestionOption(index, optionIndex, value) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, options: q.options.map((o, oi) => (oi === optionIndex ? value : o)) } : q))
    )
  }
  function removeQuestion(index) {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  async function loadBankQuestions() {
    setBankLoading(true)
    setBankError('')
    try {
      const { questions: rows } = await getBankQuestions({ subject, grade: Number(bankGrade) })
      setBankQuestions(rows)
    } catch (err) {
      setBankError(err.message || t('teacher.loadQuestionsFailed'))
    } finally {
      setBankLoading(false)
    }
  }

  async function handleAddRandom() {
    setBankLoading(true)
    setBankError('')
    try {
      const { questions: rows } = await getBankQuestions({ subject, grade: Number(bankGrade), randomCount: Number(randomCount) })
      setSelectedBankIds((prev) => {
        const next = new Set(prev)
        for (const r of rows) next.add(r.id)
        return next
      })
      setBankQuestions((prev) => {
        const existingIds = new Set((prev || []).map((q) => q.id))
        return [...(prev || []), ...rows.filter((r) => !existingIds.has(r.id))]
      })
    } catch (err) {
      setBankError(err.message || t('teacher.loadRandomFailed'))
    } finally {
      setBankLoading(false)
    }
  }

  function toggleBankQuestion(id) {
    setSelectedBankIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function buildBankQuestionsPayload() {
    return (bankQuestions || [])
      .filter((q) => selectedBankIds.has(q.id))
      .map((q) => ({ question: q.question, options: q.options, correct: q.correct, explanation: q.explanation }))
  }

  async function handleSubmit() {
    setSubmitError('')
    if (!title.trim()) return setSubmitError(t('teacher.titleRequired'))
    if (!dueDate) return setSubmitError(t('teacher.dueDateRequired'))

    const finalQuestions = tab === 'upload' ? questions : buildBankQuestionsPayload()
    if (finalQuestions.length === 0) return setSubmitError(t('teacher.addQuestionRequired'))

    setSubmitting(true)
    try {
      await createHomework({ title: title.trim(), subject, dueDate, classIds: [classId], questions: finalQuestions })
      onCreated()
    } catch (err) {
      setSubmitError(err.message || t('teacher.createAssignmentFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="screen">
      <TopBar title={t('teacher.assignHomework')} subtitle={className} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      <div className="auth-tabs">
        <button type="button" className={`auth-tab ${tab === 'upload' ? 'auth-tab--active' : ''}`} onClick={() => setTab('upload')}>
          {t('teacher.fromUpload')}
        </button>
        <button type="button" className={`auth-tab ${tab === 'bank' ? 'auth-tab--active' : ''}`} onClick={() => setTab('bank')}>
          {t('teacher.fromQuestionBank')}
        </button>
      </div>

      {tab === 'upload' ? (
        <div className="finance-section-card">
          <h3 className="section-heading">{t('teacher.uploadWorksheet')}</h3>
          <p className="field-hint">{t('teacher.uploadWorksheetHint')}</p>
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={handleFilesSelected} />
          {files.length > 0 && (
            <p className="field-hint">
              {t('teacher.filesSelected', { count: files.length })}
            </p>
          )}
          <button type="button" className="btn btn-secondary btn-block" onClick={handleExtract} disabled={extracting || files.length === 0}>
            {extracting ? t('teacher.readingDocument') : t('teacher.extractQuestions')}
          </button>
          {extractError && <p className="form-error">{extractError}</p>}
          {skippedCount > 0 && (
            <p className="field-hint">
              {t('teacher.questionsSkipped', { count: skippedCount })}
            </p>
          )}

          {questions.length > 0 && (
            <div className="homework-question-list">
              {questions.map((q, i) => (
                <div key={i} className="homework-question-editor">
                  <div className="homework-question-editor-header">
                    <span>{t('teacher.questionNumber', { number: i + 1 })}</span>
                    <button type="button" className="btn btn-ghost btn-small" onClick={() => removeQuestion(i)}>
                      {t('teacher.remove')}
                    </button>
                  </div>
                  <textarea value={q.question} onChange={(e) => updateQuestionField(i, 'question', e.target.value)} rows={2} />
                  {q.options.map((opt, oi) => (
                    <label key={oi} className="homework-question-option-row">
                      <input type="radio" checked={q.correct === oi} onChange={() => updateQuestionField(i, 'correct', oi)} />
                      <input type="text" value={opt} onChange={(e) => updateQuestionOption(i, oi, e.target.value)} />
                    </label>
                  ))}
                  <textarea
                    className="homework-question-explanation"
                    value={q.explanation || ''}
                    onChange={(e) => updateQuestionField(i, 'explanation', e.target.value)}
                    rows={2}
                    placeholder={t('teacher.explanationOptional')}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="finance-section-card">
          <h3 className="section-heading">{t('teacher.browseQuestionBank')}</h3>
          <div className="homework-bank-filters">
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(`subjects.${s.id}`)}
                </option>
              ))}
            </select>
            <select value={bankGrade} onChange={(e) => setBankGrade(e.target.value)}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {t('common.gradeLabel', { grade: g })}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary btn-small" onClick={loadBankQuestions} disabled={bankLoading}>
              {bankLoading ? t('common.loading') : t('teacher.browse')}
            </button>
          </div>

          <div className="home-action-wrap">
            <input
              type="number"
              min="1"
              max="50"
              value={randomCount}
              onChange={(e) => setRandomCount(e.target.value)}
              className="homework-random-count-input"
            />
            <button type="button" className="btn btn-secondary btn-small" onClick={handleAddRandom} disabled={bankLoading}>
              {t('teacher.addRandomQuestions')}
            </button>
          </div>

          {bankError && <p className="form-error">{bankError}</p>}
          <p className="field-hint">
            {t('teacher.questionsSelected', { count: selectedBankIds.size })}
          </p>

          {bankQuestions && (
            <div className="homework-question-list">
              {bankQuestions.length === 0 && <p className="field-hint">{t('teacher.noQuestionsFound')}</p>}
              {bankQuestions.map((q) => (
                <label key={q.id} className="homework-bank-question-row">
                  <input type="checkbox" checked={selectedBankIds.has(q.id)} onChange={() => toggleBankQuestion(q.id)} />
                  <span>{q.question}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="finance-section-card">
        <h3 className="section-heading">{t('teacher.assignmentDetails')}</h3>
        <div className="field">
          <label htmlFor="hw-title">{t('teacher.titleLabel')}</label>
          <input id="hw-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit 2 Review" />
        </div>
        {tab === 'upload' && (
          <div className="field">
            <label htmlFor="hw-subject">{t('teacher.subjectLabel')}</label>
            <select id="hw-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(`subjects.${s.id}`)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="hw-due-date">{t('teacher.dueDateLabel')}</label>
          <input id="hw-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        {submitError && <p className="form-error">{submitError}</p>}
        <button type="button" className="btn btn-primary btn-block" onClick={handleSubmit} disabled={submitting}>
          {submitting ? t('teacher.creating') : t('teacher.assignHomework')}
        </button>
      </div>
    </div>
  )
}
