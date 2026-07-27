import { createStudentHandler } from '../_lib/studentHandler.js'
import { getProgressForUser } from '../_lib/db.js'

// NOT one of the originally requested endpoints — added to close a gap.
// Backs getProgress() in src/lib/storage.js, which every student screen
// depends on for the full { streak, longestStreak, xp, coins, history }
// shape (stats display, Recent Answers list, retry/streak calculations).
// get-daily-progress.js and get-streak.js (both requested) return narrower
// slices of this same data and don't cover what getProgress() needs — this
// endpoint is required for "move all direct Supabase calls for student
// data off the client" to actually be true for the most-used call in the app.
async function handle({ userId }) {
  return getProgressForUser(userId)
}

export default createStudentHandler({ method: 'GET', handle })
