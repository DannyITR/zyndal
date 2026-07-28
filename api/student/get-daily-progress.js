import { createStudentHandler } from '../_lib/studentHandler.js'
import { getProgressForUser, syncUserTimezone } from '../_lib/db.js'
import { todayStr, isValidTimeZone, DEFAULT_TIMEZONE, TOTAL_SUBJECTS } from '../../src/lib/streak.js'

// Drives the subject grid's per-card state (SubjectDashboard.jsx, via
// StudentFlow.jsx) — not just a count anymore now that the grid shows a
// distinct red "Incorrect" state alongside the green "Done" one. "Today" is
// computed in the caller's own local timezone (see submit-answer.js's
// comment on why the server can't detect this itself), so a subject
// correctly stays in yesterday's completed/incorrect state until the
// user's own midnight, not UTC's.
function computeDailyState(history, today) {
  const completed = new Set()
  const attempted = new Set()
  for (const entry of history) {
    if (entry.date !== today) continue
    attempted.add(entry.subjectId)
    if (entry.correct) completed.add(entry.subjectId)
  }
  // A correct answer always wins if a subject somehow ended up with both —
  // today's app only ever persists one first attempt per subject per day,
  // but this stays correct even if that ever changes.
  const incorrect = [...attempted].filter((id) => !completed.has(id))
  return { completed: [...completed], incorrect }
}

async function handle({ userId, body }) {
  const timezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE
  const today = todayStr(new Date(), timezone)
  await syncUserTimezone(userId, timezone)

  const progress = await getProgressForUser(userId)
  const { completed, incorrect } = computeDailyState(progress.history, today)

  return {
    completed_subjects: completed,
    incorrect_subjects: incorrect,
    total_completed: completed.length,
    streak_safe: completed.length >= TOTAL_SUBJECTS,
  }
}

export default createStudentHandler({ method: 'GET', handle })
