import { createStudentHandler } from '../_lib/studentHandler.js'
import { getStreakRow } from '../_lib/db.js'

// A narrower, streak-only endpoint as requested. No current client screen
// calls this specifically — every existing caller needs the full answer
// history too (see get-progress.js) — but it's available for a future
// lighter-weight streak display that doesn't need to load history.
async function handle({ userId }) {
  const row = await getStreakRow(userId)
  return {
    current_streak: row.current_streak,
    longest_streak: row.longest_streak,
    total_xp: row.total_xp,
    coin_balance: row.coin_balance,
    last_answered_date: row.last_answered_date,
  }
}

export default createStudentHandler({ method: 'GET', handle })
