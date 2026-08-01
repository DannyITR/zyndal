import { useEffect, useState } from 'react'
import { getTeacherClasses, createHomework, getBankQuestions } from '../../lib/storage'
import { processUploadedDocument } from '../../lib/ai'
import { validateUploadFile } from '../../lib/imageUtils'
import { SUBJECTS } from '../../lib/questions'
import TopBar from '../shared/TopBar'

const GRADES = [7, 8, 9, 10, 11]

export default function AssignHomeworkScreen({ user, onBack, onLogout, onLogoClick, onCreated }) {
  const [tab, setTab] = useState('upload') // upload | bank
  const [classes, setClasses] = useState(null)
  const [selectedClassIds, setSelectedClassIds] = useState([])
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

  useEffect(() => {
    getTeacherClasses()
      .then((data) => setClasses(data.classes))
      .catch(() => setClasses([]))
  }, [])

  function toggleClass(id) {
    setSelectedClassIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

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
      setExtractError('Choose a photo or PDF first.')
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
      setExtractError(err.message || "Couldn't read this document. Please try again.")
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
      setBankError(err.message || "Couldn't load questions.")
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
      setBankError(err.message || "Couldn't load random questions.")
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
    if (!title.trim()) return setSubmitError('Title is required.')
    if (!dueDate) return setSubmitError('Due date is required.')
    if (selectedClassIds.length === 0) return setSubmitError('Select at least one class.')

    const finalQuestions = tab === 'upload' ? questions : buildBankQuestionsPayload()
    if (finalQuestions.length === 0) return setSubmitError('Add at least one question.')

    setSubmitting(true)
    try {
      await createHomework({ title: title.trim(), subject, dueDate, classIds: selectedClassIds, questions: finalQuestions })
      onCreated()
    } catch (err) {
      setSubmitError(err.message || "Couldn't create the assignment. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="screen">
      <TopBar title="📚 Assign Homework" username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      <div className="auth-tabs">
        <button type="button" className={`auth-tab ${tab === 'upload' ? 'auth-tab--active' : ''}`} onClick={() => setTab('upload')}>
          From Upload
        </button>
        <button type="button" className={`auth-tab ${tab === 'bank' ? 'auth-tab--active' : ''}`} onClick={() => setTab('bank')}>
          From Question Bank
        </button>
      </div>

      {tab === 'upload' ? (
        <div className="finance-section-card">
          <h3 className="section-heading">Upload a Worksheet</h3>
          <p className="field-hint">Upload a photo or PDF of a test or worksheet with questions and answers.</p>
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={handleFilesSelected} />
          {files.length > 0 && (
            <p className="field-hint">
              {files.length} file{files.length === 1 ? '' : 's'} selected
            </p>
          )}
          <button type="button" className="btn btn-secondary btn-block" onClick={handleExtract} disabled={extracting || files.length === 0}>
            {extracting ? 'Reading document…' : 'Extract Questions'}
          </button>
          {extractError && <p className="form-error">{extractError}</p>}
          {skippedCount > 0 && (
            <p className="field-hint">
              {skippedCount} question{skippedCount === 1 ? '' : 's'} skipped — not usable as multiple choice.
            </p>
          )}

          {questions.length > 0 && (
            <div className="homework-question-list">
              {questions.map((q, i) => (
                <div key={i} className="homework-question-editor">
                  <div className="homework-question-editor-header">
                    <span>Question {i + 1}</span>
                    <button type="button" className="btn btn-ghost btn-small" onClick={() => removeQuestion(i)}>
                      Remove
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
                    placeholder="Explanation (optional)"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="finance-section-card">
          <h3 className="section-heading">Browse Question Bank</h3>
          <div className="homework-bank-filters">
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select value={bankGrade} onChange={(e) => setBankGrade(e.target.value)}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary btn-small" onClick={loadBankQuestions} disabled={bankLoading}>
              {bankLoading ? 'Loading…' : 'Browse'}
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
              🎲 Add random questions
            </button>
          </div>

          {bankError && <p className="form-error">{bankError}</p>}
          <p className="field-hint">
            {selectedBankIds.size} question{selectedBankIds.size === 1 ? '' : 's'} selected
          </p>

          {bankQuestions && (
            <div className="homework-question-list">
              {bankQuestions.length === 0 && <p className="field-hint">No questions found for this subject/grade yet.</p>}
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
        <h3 className="section-heading">Assignment Details</h3>
        <div className="field">
          <label htmlFor="hw-title">Title</label>
          <input id="hw-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit 2 Review" />
        </div>
        {tab === 'upload' && (
          <div className="field">
            <label htmlFor="hw-subject">Subject</label>
            <select id="hw-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="hw-due-date">Due date</label>
          <input id="hw-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Assign to</label>
          {!classes ? (
            <p className="field-hint">Loading your classes…</p>
          ) : classes.length === 0 ? (
            <p className="field-hint">Create a class first (My Classes → Create Class).</p>
          ) : (
            classes.map((c) => (
              <label key={c.id} className="checkbox-field">
                <input type="checkbox" checked={selectedClassIds.includes(c.id)} onChange={() => toggleClass(c.id)} />
                <span>{c.name}</span>
              </label>
            ))
          )}
        </div>

        {submitError && <p className="form-error">{submitError}</p>}
        <button type="button" className="btn btn-primary btn-block" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Creating…' : 'Assign Homework'}
        </button>
      </div>
    </div>
  )
}
