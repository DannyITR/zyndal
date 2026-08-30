import { useTranslation } from 'react-i18next'

// The home screen's single entry point into the daily question — replaces
// the old 6-subject grid (see SubjectDashboard.jsx, kept but no longer
// rendered from StudentFlow.jsx) now that every student gets one shared,
// rotating subject per day instead of one per subject. Deliberately its own
// component/styling rather than reusing .subject-card/.subject-grid, which
// are being kept as-is for the upcoming class-card work.
export default function TodaysQuestionCard({ subject, isCompleted, isIncorrect, onSelect, onShareClick, isToday }) {
  const { t } = useTranslation()
  const attempted = isCompleted || isIncorrect

  return (
    <div className="todays-question-wrap">
      <button
        type="button"
        className={`todays-question-card ${isCompleted ? 'todays-question-card--completed' : ''} ${isIncorrect ? 'todays-question-card--incorrect' : ''}`}
        style={{ '--subject-color': subject.color }}
        onClick={onSelect}
      >
        <span className="todays-question-label">{t('home.todaysQuestion')}</span>
        <span className="todays-question-icon">{subject.icon}</span>
        <span className="todays-question-name">{t(`subjects.${subject.id}`)}</span>
        {isCompleted && <span className="todays-question-badge">{t('home.doneBadge')}</span>}
        {isIncorrect && <span className="todays-question-badge todays-question-badge--incorrect">{t('home.incorrectBadge')}</span>}
      </button>

      {attempted && isToday && (
        <button type="button" className="todays-question-share" onClick={onShareClick} aria-label={t('nav.shareDailyScore')}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          {t('nav.share')}
        </button>
      )}
    </div>
  )
}
