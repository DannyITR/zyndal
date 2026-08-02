import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createClass } from '../../lib/storage'

export default function CreateClassModal({ onCreated, onClose }) {
  const { t } = useTranslation()
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
      setError(err.message || t('teacher.createClassFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={createdClass ? onClose : undefined}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {createdClass ? (
          <>
            <h2 className="modal-title">{t('teacher.classCreated')}</h2>
            <p className="field-hint">{t('teacher.shareCodeWithStudents')}</p>
            <p className="teacher-code-display">{createdClass.teacher_code}</p>
            <p className="field-hint">
              {t('teacher.joinCodeHintPrefix')} <strong>{createdClass.name}</strong>.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
                {t('common.done')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="modal-title">{t('teacher.createClassTitle')}</h2>
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="class-name">{t('teacher.className')}</label>
                <input
                  id="class-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Math 416 - Period 2"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="class-grade">{t('settings.grade')}</label>
                <select id="class-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
                  <option value="7">7</option>
                  <option value="8">8</option>
                  <option value="9">9</option>
                  <option value="10">10</option>
                  <option value="11">11</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="class-school">{t('settings.schoolName')}</label>
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
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('teacher.creating') : t('teacher.createClass')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
