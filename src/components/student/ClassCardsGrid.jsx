import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMySchoolSubjectGroups } from '../../lib/storage'
import { getSubject } from '../../lib/questions'

// One tile per class on the home screen, below the Today's Question card —
// reuses the exact .subject-grid/.subject-card look from the old 6-subject
// grid (see SubjectDashboard.jsx, still dormant/reserved) since that's the
// design this was always meant to become. No done/incorrect badge here —
// unlike the daily question, a class has no single per-day completion
// state (just a small "Join" hint on a group the student hasn't joined
// yet — tapping still opens the full Class Card page to actually join, see
// ClassCard.jsx's Join Group button). Backed by real school_subject_groups
// data (api/student/get-school-subject-groups.js) now that the schools
// feature exists — each group is this student's own school+grade's
// unclaimed subject group until a teacher claim attaches a real class to it.
// "Joined" covers both ways a student can belong to a class: the open
// unclaimed group itself (group.joined) and a teacher-claimed class born
// from that group (group.claimedClasses — a separate class_students
// membership, see api/student/get-school-subject-groups.js).
function isJoined(group) {
  return group.joined || group.claimedClasses.length > 0
}

export default function ClassCardsGrid({ onSelectClass, onOpenSettings }) {
  const { t } = useTranslation()
  const [groups, setGroups] = useState(null) // null while loading
  const [hasSchool, setHasSchool] = useState(true)
  const [hasGrade, setHasGrade] = useState(true)
  const [schoolName, setSchoolName] = useState(null)
  const [grade, setGrade] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    getMySchoolSubjectGroups()
      .then((data) => {
        if (cancelled) return
        setHasSchool(Boolean(data.schoolId))
        setHasGrade(Boolean(data.grade))
        setSchoolName(data.schoolName)
        setGrade(data.grade)
        setGroups(data.groups)
      })
      .catch(() => {
        // Previously left `groups` at null forever on any failure, which
        // rendered nothing at all (not even the section heading) — this at
        // least tells the student something went wrong instead of the
        // section silently vanishing.
        if (!cancelled) setLoadError(t('home.loadClassesFailed'))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loadError) {
    return (
      <div className="class-cards-section">
        <h3 className="section-heading">{t('home.myClasses')}</h3>
        <p className="form-error">{loadError}</p>
      </div>
    )
  }

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

  // A student can set their school (Settings) without ever having set a
  // grade (optional at signup) — the API can't know which grade's groups to
  // show without one, and silently returns none. Surface that explicitly
  // instead of just rendering an empty grid with no explanation.
  if (!hasGrade) {
    return (
      <div className="class-cards-section">
        <h3 className="section-heading">{t('home.myClasses')}</h3>
        <button type="button" className="class-cards-no-school" onClick={onOpenSettings}>
          {t('home.noGradeSetPrompt')}
        </button>
      </div>
    )
  }

  return (
    <div className="class-cards-section">
      <h3 className="section-heading">{t('home.myClasses')}</h3>
      {groups.length === 0 ? (
        <p className="field-hint">{t('home.noClassesForSchool')}</p>
      ) : (
        <div className="subject-grid">
          {[...groups.filter(isJoined), ...groups.filter((g) => !isJoined(g))].map((group) => {
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
                {!group.joined && <span className="subject-card-badge subject-card-badge--neutral">{t('home.joinBadge')}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
