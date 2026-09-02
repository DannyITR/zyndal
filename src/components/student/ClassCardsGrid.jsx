import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMySchoolSubjectGroups } from '../../lib/storage'
import { getSubject } from '../../lib/questions'

// One tile per class the student belongs to (or could join) on the home
// screen, below the Today's Question card — reuses the exact
// .subject-grid/.subject-card look from the old 6-subject grid (see
// SubjectDashboard.jsx, still dormant/reserved) since that's the design
// this was always meant to become. No done/incorrect badge here — unlike
// the daily question, a class has no single per-day completion state (just
// a small "Join" hint on a group the student hasn't joined yet — tapping
// still opens the full Class Card page to actually join, see ClassCard.jsx's
// Join Group button). Backed by real school_subject_groups data
// (api/student/get-school-subject-groups.js) now that the schools feature
// exists.
//
// One entry per actual class (not one tile per subject) — a subject's open
// unclaimed group and each teacher-claimed class the student has joined are
// separate memberships with their own separate Class Card and forum, so
// each gets its own tile here. A 'class' entry is always joined (the
// student is already enrolled/teaching it); a 'group' entry may or may not
// be.
function isJoined(entry) {
  return entry.kind === 'class' || entry.joined
}

export default function ClassCardsGrid({ onSelectClass, onOpenSettings }) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState(null) // null while loading
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
        setEntries(data.entries)
      })
      .catch(() => {
        // Previously left `entries` at null forever on any failure, which
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

  if (entries === null) return null

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
      {entries.length === 0 ? (
        <p className="field-hint">{t('home.noClassesForSchool')}</p>
      ) : (
        <div className="subject-grid">
          {[...entries.filter(isJoined), ...entries.filter((e) => !isJoined(e))].map((entry) => {
            const subject = getSubject(entry.subject)
            return (
              <button
                key={`${entry.kind}-${entry.id}`}
                type="button"
                className="subject-card"
                style={{ '--subject-color': subject.color }}
                onClick={() => onSelectClass({ ...entry, schoolName, grade })}
              >
                <span className="subject-card-icon">{subject.icon}</span>
                <span className="subject-card-name">{t(`subjects.${subject.id}`)}</span>
                <span className="subject-card-detail">
                  {entry.kind === 'class' ? entry.name : t('classCard.unclaimedStatus', { grade, school: schoolName })}
                </span>
                {entry.kind === 'group' && !entry.joined && (
                  <span className="subject-card-badge subject-card-badge--neutral">{t('home.joinBadge')}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
