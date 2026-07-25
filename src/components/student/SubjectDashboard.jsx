import { SUBJECTS } from '../../lib/questions'

export default function SubjectDashboard({ completedSubjectIds, onSelectSubject }) {
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

          return (
            <button
              key={subject.id}
              type="button"
              className={`subject-card ${isCompleted ? 'subject-card--completed' : ''}`}
              style={{ '--subject-color': subject.color }}
              onClick={() => onSelectSubject(subject.id)}
            >
              <span className="subject-card-icon">{subject.icon}</span>
              <span className="subject-card-name">{subject.name}</span>
              {isCompleted && <span className="subject-card-badge">✓ Done</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
