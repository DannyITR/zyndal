import { useEffect, useState } from 'react'
import { getOrGenerateCurriculumOutline, setCurrentUnit } from '../../lib/storage'
import { SUBJECTS } from '../../lib/questions'

// The `classes` table has no subject column of its own (a class's homework
// can span any subject — see homework_assignments.subject) — so the teacher
// picks a subject here, transiently, only to pull that subject+grade's
// curriculum outline for the unit dropdown. It isn't persisted on the class;
// only the resulting unit number/title are.
export default function SetCurrentUnitModal({ classId, classGrade, onSaved, onClose }) {
  const [subject, setSubject] = useState(SUBJECTS[0].id)
  const [outline, setOutline] = useState(null)
  const [loadingOutline, setLoadingOutline] = useState(false)
  const [outlineError, setOutlineError] = useState('')
  const [unitNumber, setUnitNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoadingOutline(true)
    setOutlineError('')
    setOutline(null)
    setUnitNumber('')
    getOrGenerateCurriculumOutline(subject, classGrade)
      .then((data) => {
        if (cancelled) return
        setOutline(data)
        const firstUnit = data?.outline_data?.units?.[0]
        if (firstUnit) setUnitNumber(String(firstUnit.unit_number))
      })
      .catch((err) => {
        if (!cancelled) setOutlineError(err.message || "Couldn't load the curriculum outline for this subject.")
      })
      .finally(() => {
        if (!cancelled) setLoadingOutline(false)
      })
    return () => {
      cancelled = true
    }
  }, [subject, classGrade])

  const units = outline?.outline_data?.units || []

  async function handleSave() {
    const unit = units.find((u) => String(u.unit_number) === unitNumber)
    if (!unit) return
    setSaveError('')
    setSaving(true)
    try {
      const { class: updated } = await setCurrentUnit(classId, unit.unit_number, unit.unit_title)
      onSaved(updated)
      onClose()
    } catch (err) {
      setSaveError(err.message || "Couldn't save the current unit. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Set Current Unit</h2>
        <p className="field-hint">Choose the subject and unit this class is currently studying.</p>

        <div className="field">
          <label htmlFor="unit-subject">Subject</label>
          <select id="unit-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="unit-select">Unit</label>
          {loadingOutline ? (
            <p className="field-hint">Loading units…</p>
          ) : outlineError ? (
            <p className="form-error">{outlineError}</p>
          ) : (
            <select id="unit-select" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)}>
              {units.map((u) => (
                <option key={u.unit_number} value={u.unit_number}>
                  Unit {u.unit_number} — {u.unit_title}
                </option>
              ))}
            </select>
          )}
        </div>

        {saveError && <p className="form-error">{saveError}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || loadingOutline || units.length === 0}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
