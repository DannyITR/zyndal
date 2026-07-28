import { SUBJECTS } from '../../lib/questions'

export default function SubjectDashboard({
  completedSubjectIds,
  incorrectSubjectIds = new Set(),
  onSelectSubject,
  onShareClick,
  receivedShareCount = 0,
}) {
  const correctCount = completedSubjectIds.size
  const totalCount = SUBJECTS.length
  // "Completed" for the progress text and score box means attempted today,
  // right or wrong — the box's own score line is the only place that cares
  // about correctness.
  const attemptedCount = correctCount + incorrectSubjectIds.size
  const allAttempted = attemptedCount === totalCount

  return (
    <div className="subject-dashboard">
      <p className={`subject-dashboard-lead ${allAttempted ? 'subject-dashboard-lead--done' : ''}`}>
        {allAttempted ? '✅ All 6 done for today!' : `${attemptedCount}/${totalCount} completed today — answer all 6`}
      </p>

      {allAttempted && (
        <div className="daily-score-box daily-score-box--celebrate">
          <span className="daily-score-box-text">
            Today's score: {correctCount}/{totalCount} ✓
          </span>
          <button type="button" className="daily-score-box-share" onClick={onShareClick} aria-label="Share daily score">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            {receivedShareCount > 0 && <span className="notification-badge">{receivedShareCount}</span>}
          </button>
        </div>
      )}

      <div className="subject-grid">
        {SUBJECTS.map((subject) => {
          const isCompleted = completedSubjectIds.has(subject.id)
          // A correct answer always wins — see get-daily-progress.js, which
          // already excludes anything in completed_subjects from
          // incorrect_subjects, but this stays correct even if that
          // invariant ever changes.
          const isIncorrect = !isCompleted && incorrectSubjectIds.has(subject.id)

          return (
            <button
              key={subject.id}
              type="button"
              className={`subject-card ${isCompleted ? 'subject-card--completed' : ''} ${isIncorrect ? 'subject-card--incorrect' : ''}`}
              style={{ '--subject-color': subject.color }}
              onClick={() => onSelectSubject(subject.id)}
            >
              <span className="subject-card-icon">{subject.icon}</span>
              <span className="subject-card-name">{subject.name}</span>
              {isCompleted && <span className="subject-card-badge">✓ Done</span>}
              {isIncorrect && <span className="subject-card-badge subject-card-badge--incorrect">✗ Incorrect</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
