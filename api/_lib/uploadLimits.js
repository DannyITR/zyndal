// Soft per-subject weekly upload cap — independent of the premium paywall
// (api/_lib/subscription.js); see WEEKLY_UPLOAD_PAGE_LIMIT in
// src/lib/uploads.js and upload_weekly_usage in supabase/schema.sql for why
// this is tracked in its own ledger table rather than summed from
// uploads.pages_count.
import { supabase } from './auth.js'
import { mondayOfWeek, todayStr, isValidTimeZone, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'
import { WEEKLY_UPLOAD_PAGE_LIMIT } from '../../src/lib/uploads.js'

export { WEEKLY_UPLOAD_PAGE_LIMIT }

// The Monday (inclusive) of the caller's current ISO week, in their own
// timezone — falls back to DEFAULT_TIMEZONE like every other date-boundary
// check in this codebase (see submit-answer.js) for a missing/invalid value.
export function currentWeekStart(timezone) {
  const tz = isValidTimeZone(timezone) ? timezone : DEFAULT_TIMEZONE
  return mondayOfWeek(todayStr(new Date(), tz))
}

// Throws UPLOAD_LIMIT_REACHED if adding `newPages` to `subject`'s usage this
// week would push the student past WEEKLY_UPLOAD_PAGE_LIMIT; otherwise
// records the usage and returns. Read-then-write, same non-atomic-but-
// good-enough pattern already used for streaks/coin balances elsewhere in
// this codebase (see submit-answer.js) — a soft usage cap, not a
// billing-critical counter, so a rare double-count from a genuine race
// isn't worth a Postgres RPC just to close.
export async function assertUploadPagesAllowed({ userId, subject, timezone, newPages }) {
  const weekStart = currentWeekStart(timezone)

  const { data: usage, error } = await supabase
    .from('upload_weekly_usage')
    .select('pages_used')
    .eq('user_id', userId)
    .eq('subject', subject)
    .eq('week_start', weekStart)
    .maybeSingle()
  if (error) throw error

  const pagesUsed = usage?.pages_used || 0
  if (pagesUsed + newPages > WEEKLY_UPLOAD_PAGE_LIMIT) {
    const err = new Error(`Weekly upload limit reached for ${subject} (${WEEKLY_UPLOAD_PAGE_LIMIT} pages/week).`)
    err.status = 403
    err.code = 'UPLOAD_LIMIT_REACHED'
    throw err
  }

  const { error: upsertError } = await supabase
    .from('upload_weekly_usage')
    .upsert({ user_id: userId, subject, week_start: weekStart, pages_used: pagesUsed + newPages }, { onConflict: 'user_id,subject,week_start' })
  if (upsertError) throw upsertError
}
