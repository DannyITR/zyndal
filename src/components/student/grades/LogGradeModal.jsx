import { useState } from 'react'
import { SUBJECTS } from '../../../lib/questions'
import { todayStr } from '../../../lib/streak'
import { createGrade } from '../../../lib/storage'

export default function LogGradeModal({ user, lockedSubjectId, onSaved, onClose }) {
  const [subjectId, setSubjectId] = useState(lockedSubjectId || 'math')
  const [testName, setTestName] = useState('')
  const [gradePercentage, setGradePercentage] = useState('')
  const [testDate, setTestDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit =
    testName.trim() &&
    gradePercentage !== '' &&
    Number(gradePercentage) >= 0 &&
    Number(gradePercentage) <= 100 &&
    testDate &&
    !saving

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      await createGrade({
        userId: user.id,
        subject: subjectId,
        testName: testName.trim(),
        gradePercentage: Math.round(Number(gradePercentage)),
        testDate,
        notes: notes.trim() || null,
      })
      await onSaved()
    } catch (err) {
      console.error('[Grades] log grade failed:', err)
      setError(err.message || "Couldn't save this grade. Please try again.")
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Log a Grade</h2>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="grade-subject">Subject</label>
            {lockedSubjectId ? (
              <p className="field-static">
                {SUBJECTS.find((s) => s.id === lockedSubjectId)?.icon} {SUBJECTS.find((s) => s.id === lockedSubjectId)?.name}
              </p>
            ) : (
              <select id="grade-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {SUBJECTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="field">
            <label htmlFor="grade-test-name">Test / Assignment name</label>
            <input
              id="grade-test-name"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="e.g. Chapter 4 Quiz"
            />
          </div>

          <div className="field">
            <label htmlFor="grade-percentage">Grade received (%)</label>
            <input
              id="grade-percentage"
              type="number"
              min="0"
              max="100"
              value={gradePercentage}
              onChange={(e) => setGradePercentage(e.target.value)}
              placeholder="e.g. 85"
            />
          </div>

          <div className="field">
            <label htmlFor="grade-date">Date of test</label>
            <input
              id="grade-date"
              type="date"
              max={todayStr()}
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="grade-notes">Notes (optional)</label>
            <textarea
              id="grade-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you want to remember"
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost btn-block" disabled={saving} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit}>
              {saving ? 'Saving…' : 'Save Grade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
