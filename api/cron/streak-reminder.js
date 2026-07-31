import { supabase } from '../_lib/auth.js'
import { insertNotification } from '../_lib/notifications.js'
import { sendPushToUser } from '../_lib/push.js'
import { todayStr, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'

const REMINDER_HOUR = 21 // 9pm local time, per zone
const ANSWERS_LOOKBACK_MS = 36 * 60 * 60 * 1000 // always covers "today" in any IANA zone
const DEDUP_LOOKBACK_MS = 20 * 60 * 60 * 1000 // covers a retry within the same 9-10pm hour

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
      .select('id, timezone, notification_preferences')
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

    const answeredTodayUserIds = new Set()
    for (const candidate of candidates) {
      const zone = candidate.timezone || DEFAULT_TIMEZONE
      const today = todayStr(new Date(), zone)
      const answeredToday = (recentAnswers || []).some((row) => row.user_id === candidate.id && todayStr(new Date(row.answered_at), zone) === today)
      if (answeredToday) answeredTodayUserIds.add(candidate.id)
    }

    // Dedup against a retry within the same hour — reuses the
    // notifications table itself rather than a new tracking table.
    const dedupSince = new Date(Date.now() - DEDUP_LOOKBACK_MS).toISOString()
    const { data: alreadyReminded, error: remindedError } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('type', 'streak_reminder')
      .in('user_id', candidateIds)
      .gte('created_at', dedupSince)
    if (remindedError) throw remindedError
    const alreadyRemindedIds = new Set((alreadyReminded || []).map((row) => row.user_id))

    const toRemind = candidates.filter((u) => !answeredTodayUserIds.has(u.id) && !alreadyRemindedIds.has(u.id))

    const title = "⚠️ Don't lose your streak!"
    const body = "You haven't answered today's questions yet — answer at least one to keep your flame alive 🔥"
    const url = 'https://zyndal.ca'

    for (const u of toRemind) {
      await insertNotification({ userId: u.id, type: 'streak_reminder', title, body })
      await sendPushToUser({ userId: u.id, type: 'streak_reminder', title, body, url })
    }

    res.status(200).json({ checked: users.length, candidates: candidates.length, reminded: toRemind.length })
  } catch (err) {
    console.error('[cron] streak-reminder failed:', err)
    res.status(500).json({ error: 'Internal error' })
  }
}
