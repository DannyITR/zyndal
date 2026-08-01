import { useState } from 'react'
import { createClass } from '../../lib/storage'

export default function CreateClassModal({ onCreated, onClose }) {
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('9')
  const [school, setSchool] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdClass, setCreatedClass] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { class: newClass } = await createClass({ name: name.trim(), grade: Number(grade), school: school.trim() })
      setCreatedClass(newClass)
      onCreated(newClass)
    } catch (err) {
      setError(err.message || "Couldn't create the class. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={createdClass ? onClose : undefined}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {createdClass ? (
          <>
            <h2 className="modal-title">Class Created!</h2>
            <p className="field-hint">Share this code with your students:</p>
            <p className="teacher-code-display">{createdClass.teacher_code}</p>
            <p className="field-hint">
              Students enter this code in Settings → Join a Class to join <strong>{createdClass.name}</strong>.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="modal-title">Create a Class</h2>
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="class-name">Class name</label>
                <input
                  id="class-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Math 416 - Period 2"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="class-grade">Grade</label>
                <select id="class-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
                  <option value="7">7</option>
                  <option value="8">8</option>
                  <option value="9">9</option>
                  <option value="10">10</option>
                  <option value="11">11</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="class-school">School name</label>
                <input
                  id="class-school"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="e.g. Lincoln High School"
                  required
                />
              </div>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating…' : 'Create Class'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
