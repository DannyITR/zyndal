import { supabase } from '../_lib/auth.js'
import { insertNotification } from '../_lib/notifications.js'
import { notificationText } from '../_lib/notificationText.js'
import { sendPushToUser } from '../_lib/push.js'
import { todayStr, diffDays, getEffectiveStreak, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'

const REMINDER_HOUR = 21 // 9pm local time, per zone
const ANSWERS_LOOKBACK_MS = 36 * 60 * 60 * 1000 // always covers "today" in any IANA zone
const DEDUP_LOOKBACK_MS = 20 * 60 * 60 * 1000 // covers a retry within the same 9-10pm hour

// Three distinct notification types share this one daily 9pm run, each
// gated on the student's *effective* streak (see getEffectiveStreak) and
// how many days it's been since their last correct answer:
//   - streak_reminder: effective streak > 0 (actively maintaining a streak)
//     but hasn't answered today yet — the original, unchanged behavior,
//     just no longer sent to students with no streak to lose.
//   - streak_reengagement_week: effective streak is 0 and it's been exactly
//     7 days since their last correct answer (or account creation, for a
//     student who never had one) — a single nudge, not repeated.
//   - streak_reengagement_month: effective streak is still 0 a full 30 days
//     after that same reference date, and every 30 days again after that
//     (day 30, 60, 90, ...) — so a long-inactive student gets a monthly
//     nudge instead of silence.
// All three read from streaks.current_streak/last_answered_date — no new
// column needed, last_answered_date already *is* "last active date."
const WEEK_INACTIVE_DAYS = 7
const MONTH_INACTIVE_DAYS = 30

// GET, matching Vercel's actual cron invocation method (it sends
// `Authorization: Bearer $CRON_SECRET` on a GET request) — unlike
// api/questions/generate-question-pool.js's existing cron file, which
// expects POST despite not actually being wired into vercel.json's crons
// yet; not fixing that file, just not repeating its mismatch here.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET.' })
    return
  }

  const expected = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || ''
  if (!expected || authHeader !== `Bearer ${expected}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, timezone, notification_preferences, language_preference, created_at')
      .is('deleted_at', null)
    if (usersError) throw usersError

    // Current hour per distinct timezone, computed once per zone rather
    // than once per user — a small Intl.DateTimeFormat call, no query.
    const hourByZone = new Map()
    function currentHourInZone(timeZone) {
      const zone = timeZone || DEFAULT_TIMEZONE
      if (hourByZone.has(zone)) return hourByZone.get(zone)
      let hour
      try {
        hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: zone, hour12: false, hour: 'numeric' }).format(new Date()))
      } catch {
        hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: DEFAULT_TIMEZONE, hour12: false, hour: 'numeric' }).format(new Date()))
      }
      hourByZone.set(zone, hour)
      return hour
    }

    const candidates = (users || []).filter((u) => currentHourInZone(u.timezone) === REMINDER_HOUR)
    if (candidates.length === 0) {
      res.status(200).json({ checked: users?.length || 0, reminded: 0 })
      return
    }

    const candidateIds = candidates.map((u) => u.id)

    // One bounded query for everyone's recent answers — bucketed per user
    // in JS below using each user's own timezone, instead of a per-user
    // query (see plan's Context section for why getProgressForUser's
    // unbounded-per-user pattern doesn't scale here).
    const since = new Date(Date.now() - ANSWERS_LOOKBACK_MS).toISOString()
    const { data: recentAnswers, error: answersError } = await supabase
      .from('answers')
      .select('user_id, answered_at')
      .in('user_id', candidateIds)
      .gte('answered_at', since)
    if (answersError) throw answersError

    // Effective streak + inactivity, per candidate — needs streaks.
    const { data: streakRows, error: streaksError } = await supabase
      .from('streaks')
      .select('user_id, current_streak, last_answered_date')
      .in('user_id', candidateIds)
    if (streaksError) throw streaksError
    const streakByUserId = new Map(streakRows.map((r) => [r.user_id, r]))

    // Dedup against a retry within the same hour — reuses the
    // notifications table itself rather than a new tracking table. Shared
    // across all three types: a candidate should get at most one of them
    // per run regardless of which one it ends up being.
    const dedupSince = new Date(Date.now() - DEDUP_LOOKBACK_MS).toISOString()
    const { data: alreadyReminded, error: remindedError } = await supabase
      .from('notifications')
      .select('user_id')
      .in('type', ['streak_reminder', 'streak_reengagement_week', 'streak_reengagement_month'])
      .in('user_id', candidateIds)
      .gte('created_at', dedupSince)
    if (remindedError) throw remindedError
    const alreadyRemindedIds = new Set((alreadyReminded || []).map((row) => row.user_id))

    const url = 'https://zyndal.ca'
    let reminded = 0

    for (const u of candidates) {
      if (alreadyRemindedIds.has(u.id)) continue

      const zone = u.timezone || DEFAULT_TIMEZONE
      const today = todayStr(new Date(), zone)
      const answeredToday = (recentAnswers || []).some((row) => row.user_id === u.id && todayStr(new Date(row.answered_at), zone) === today)
      if (answeredToday) continue

      const streakRow = streakByUserId.get(u.id) || { current_streak: 0, last_answered_date: null }
      const effectiveStreak = getEffectiveStreak({ streak: streakRow.current_streak, lastCorrectDate: streakRow.last_answered_date }, today)

      let type = null
      if (effectiveStreak > 0) {
        type = 'streak_reminder'
      } else {
        // No active streak — a student never sent a correct answer at all
        // has no last_answered_date to measure inactivity from, so their
        // account creation date stands in as "day zero" instead.
        const referenceDateStr = streakRow.last_answered_date || todayStr(new Date(u.created_at), zone)
        const daysInactive = diffDays(today, referenceDateStr)
        if (daysInactive === WEEK_INACTIVE_DAYS) {
          type = 'streak_reengagement_week'
        } else if (daysInactive >= MONTH_INACTIVE_DAYS && (daysInactive - MONTH_INACTIVE_DAYS) % MONTH_INACTIVE_DAYS === 0) {
          type = 'streak_reengagement_month'
        }
      }
      if (!type) continue

      const { title, body } = notificationText(type, u.language_preference)
      await insertNotification({ userId: u.id, type, title, body })
      await sendPushToUser({ userId: u.id, type, title, body, url })
      reminded++
    }

    res.status(200).json({ checked: users.length, candidates: candidates.length, reminded })
  } catch (err) {
    console.error('[cron] streak-reminder failed:', err)
    res.status(500).json({ error: 'Internal error' })
  }
}
