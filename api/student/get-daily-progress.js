import { createStudentHandler } from '../_lib/studentHandler.js'
import { getProgressForUser } from '../_lib/db.js'
import { todayStr, TOTAL_SUBJECTS } from '../../src/lib/streak.js'

// As requested. No current client screen calls this specifically — the
// equivalent count (subjectsLeftToday) is currently derived from the
// progress object StudentHome.jsx already has loaded for other reasons
// (Recent Answers list, etc.) — but this is available standalone for a
// future widget that needs just today's completion status.
async function handle({ userId }) {
  const today = todayStr()
  const progress = await getProgressForUser(userId)

  const completedSubjects = [...new Set(progress.history.filter((h) => h.date === today && h.correct).map((h) => h.subjectId))]

  return {
    completed_subjects: completedSubjects,
    total_completed: completedSubjects.length,
    streak_safe: completedSubjects.length >= TOTAL_SUBJECTS,
  }
}

export default createStudentHandler({ method: 'GET', handle })
