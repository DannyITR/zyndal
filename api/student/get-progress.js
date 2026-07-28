import { createStudentHandler } from '../_lib/studentHandler.js'
import { getProgressForUser, syncUserTimezone } from '../_lib/db.js'
import { isValidTimeZone, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'

// NOT one of the originally requested endpoints — added to close a gap.
// Backs getProgress() in src/lib/storage.js, which every student screen
// depends on for the full { streak, longestStreak, xp, coins, history }
// shape (stats display, Recent Answers list, retry/streak calculations,
// and StudentHome.jsx's own "already answered today" lookup for the
// currently open subject). get-daily-progress.js and get-streak.js (both
// requested) return narrower slices of this same data and don't cover what
// getProgress() needs — this endpoint is required for "move all direct
// Supabase calls for student data off the client" to actually be true for
// the most-used call in the app.
//
// timezone here for the same reason get-daily-progress.js/submit-answer.js
// need it — each history entry's date is bucketed by the caller's local
// calendar day (see rowToEntry in api/_lib/db.js), not UTC, or a late-night
// answer's "already answered today" state here could disagree with the
// subject grid's.
async function handle({ userId, body }) {
  const timezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE
  await syncUserTimezone(userId, timezone)
  return getProgressForUser(userId, timezone)
}

export default createStudentHandler({ method: 'GET', handle })
