import { useTranslation } from 'react-i18next'
import { getPlaceholderClasses } from '../../lib/questions'

// One tile per class on the home screen, below the Today's Question card —
// reuses the exact .subject-grid/.subject-card look from the old 6-subject
// grid (see SubjectDashboard.jsx, still dormant/reserved) since that's the
// design this was always meant to become. No done/incorrect badge here —
// unlike the daily question, a class has no single per-day completion
// state. Backed by getPlaceholderClasses() (src/lib/questions.js) until the
// real schools/classes feature ships.
export default function ClassCardsGrid({ onSelectClass }) {
  const { t } = useTranslation()
  const classes = getPlaceholderClasses()

  return (
    <div className="class-cards-section">
      <h3 className="section-heading">{t('home.myClasses')}</h3>
      <div className="subject-grid">
        {classes.map((classItem) => (
          <button
            key={classItem.id}
            type="button"
            className="subject-card"
            style={{ '--subject-color': classItem.color }}
            onClick={() => onSelectClass(classItem.subjectId)}
          >
            <span className="subject-card-icon">{classItem.icon}</span>
            <span className="subject-card-name">{t(`subjects.${classItem.subjectId}`)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
