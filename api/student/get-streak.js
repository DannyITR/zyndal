import { createStudentHandler } from '../_lib/studentHandler.js'
import { getStreakRow, syncUserTimezone } from '../_lib/db.js'
import { getEffectiveStreak, todayStr, isValidTimeZone, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'

// A narrower, streak-only endpoint as requested. No current client screen
// calls this specifically — every existing caller needs the full answer
// history too (see get-progress.js) — but it's available for a future
// lighter-weight streak display that doesn't need to load history.
//
// current_streak is the *effective* streak (see getEffectiveStreak) rather
// than the raw streaks.current_streak column — that raw value only gets
// corrected to 0 the next time an answer is submitted, so on its own it can
// still show a streak that's actually already broken (more than a day
// missed) until the user answers again. "Already broken" is itself
// timezone-sensitive (a full missed day means midnight in the user's own
// zone, not UTC), so this needs the same timezone param submit-answer.js
// and get-daily-progress.js take.
async function handle({ userId, body }) {
  const timezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE
  const today = todayStr(new Date(), timezone)
  await syncUserTimezone(userId, timezone)

  const row = await getStreakRow(userId)
  const effectiveStreak = getEffectiveStreak({ streak: row.current_streak, lastCorrectDate: row.last_answered_date }, today)

  return {
    current_streak: effectiveStreak,
    longest_streak: row.longest_streak,
    total_xp: row.total_xp,
    coin_balance: row.coin_balance,
    last_answered_date: row.last_answered_date,
  }
}

export default createStudentHandler({ method: 'GET', handle })
