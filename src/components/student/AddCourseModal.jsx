import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSubject } from '../../lib/questions'
import { getAdditionalCourseOptions } from '../../lib/additionalCourses'
import { addCourse } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'

// The "+ Add a course from another grade" picker on ClassCardsGrid.jsx —
// e.g. Gr 10 History & Geography or Gr 10 Math for a Gr 11 student
// repeating a course or placed in it by their school. The options come from
// src/lib/additionalCourses.js, so a new combo shows up here with no change
// to this file. Each added course becomes its own Class Card.
//
// addedKeys: `${subject}:${grade}` for courses the student already has.
export default function AddCourseModal({ studentGrade, addedKeys, onAdded, onClose }) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(null) // the option key being added
  const [error, setError] = useState('')
  const options = getAdditionalCourseOptions(studentGrade)

  async function handleAdd(option) {
    const key = `${option.subject}:${option.grade}`
    if (adding) return
    setAdding(key)
    setError('')
    try {
      await addCourse(option.subject, option.grade)
      await onAdded()
    } catch (err) {
      setError(getErrorMessage(err, t, 'courses.addFailed'))
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="modal-overlay" onClick={adding ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('courses.pickerTitle')}</h2>
        <p className="modal-subtitle">{t('courses.pickerSubtitle')}</p>

        <div className="add-course-list">
          {options.map((option) => {
            const key = `${option.subject}:${option.grade}`
            const subject = getSubject(option.subject)
            const added = addedKeys.includes(key)
            return (
              <div key={key} className="add-course-row">
                <span className="add-course-name">
                  {subject?.icon} {t('courses.subjectWithGrade', { subject: t(`subjects.${option.subject}`), grade: option.grade })}
                </span>
                {added ? (
                  <span className="add-course-added">{t('courses.added')}</span>
                ) : (
                  <button type="button" className="btn btn-secondary btn-small" disabled={Boolean(adding)} onClick={() => handleAdd(option)}>
                    {adding === key ? t('courses.adding') : t('courses.add')}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="button" className="btn btn-ghost btn-block" disabled={Boolean(adding)} onClick={onClose}>
          {t('common.done')}
        </button>
      </div>
    </div>
  )
}
