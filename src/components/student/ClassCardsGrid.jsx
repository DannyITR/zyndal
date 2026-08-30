import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMySchoolSubjectGroups } from '../../lib/storage'
import { getSubject } from '../../lib/questions'

// One tile per class on the home screen, below the Today's Question card —
// reuses the exact .subject-grid/.subject-card look from the old 6-subject
// grid (see SubjectDashboard.jsx, still dormant/reserved) since that's the
// design this was always meant to become. No done/incorrect badge here —
// unlike the daily question, a class has no single per-day completion
// state. Backed by real school_subject_groups data (api/student/get-school-
// subject-groups.js) now that the schools feature exists — each group is
// this student's own school+grade's unclaimed subject group until a teacher
// claim (a later phase) attaches a real class to it.
export default function ClassCardsGrid({ onSelectClass, onOpenSettings }) {
  const { t } = useTranslation()
  const [groups, setGroups] = useState(null) // null while loading
  const [hasSchool, setHasSchool] = useState(true)
  const [schoolName, setSchoolName] = useState(null)
  const [grade, setGrade] = useState(null)

  useEffect(() => {
    let cancelled = false
    getMySchoolSubjectGroups().then((data) => {
      if (cancelled) return
      setHasSchool(Boolean(data.schoolId))
      setSchoolName(data.schoolName)
      setGrade(data.grade)
      setGroups(data.groups)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (groups === null) return null

  if (!hasSchool) {
    return (
      <div className="class-cards-section">
        <h3 className="section-heading">{t('home.myClasses')}</h3>
        <button type="button" className="class-cards-no-school" onClick={onOpenSettings}>
          {t('home.noSchoolSetPrompt')}
        </button>
      </div>
    )
  }

  return (
    <div className="class-cards-section">
      <h3 className="section-heading">{t('home.myClasses')}</h3>
      <div className="subject-grid">
        {groups.map((group) => {
          const subject = getSubject(group.subject)
          return (
            <button
              key={group.id}
              type="button"
              className="subject-card"
              style={{ '--subject-color': subject.color }}
              onClick={() => onSelectClass({ ...group, schoolName, grade })}
            >
              <span className="subject-card-icon">{subject.icon}</span>
              <span className="subject-card-name">{t(`subjects.${subject.id}`)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
