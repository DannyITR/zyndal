import { SUBJECTS } from '../../lib/questions'

export default function SubjectDashboard({ completedSubjectIds, incorrectSubjectIds = new Set(), onSelectSubject }) {
  const completedCount = completedSubjectIds.size
  const totalCount = SUBJECTS.length
  const allDone = completedCount === totalCount

  return (
    <div className="subject-dashboard">
      <p className={`subject-dashboard-lead ${allDone ? 'subject-dashboard-lead--done' : ''}`}>
        {allDone
          ? '✅ All 6 done — streak saved for today! 🔥'
          : `${completedCount}/${totalCount} completed today — answer all 6 to keep your streak alive 🔥`}
      </p>

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
