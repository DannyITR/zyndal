import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'

const ACCOUNT_TYPES = ['student', 'parent', 'teacher']

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

// head:true makes Supabase/PostgREST return just the count, not the rows —
// cheap even against the full users/answers tables.
async function countRows(table, apply) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  if (apply) query = apply(query)
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

async function handle() {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()

  const [usersByTypeEntries, newToday, newWeek, newMonth, questionsToday, questionsAllTime, activeStreaks, premiumUsers, todaysAnswerRows] =
    await Promise.all([
      Promise.all(
        ACCOUNT_TYPES.map((type) =>
          countRows('users', (q) => q.eq('account_type', type).is('deleted_at', null)).then((count) => [type, count])
        )
      ),
      countRows('users', (q) => q.is('deleted_at', null).gte('created_at', todayIso)),
      // "This week"/"this month" are rolling 7/30-day windows, not calendar
      // week/month boundaries — simpler and avoids a separate timezone
      // decision for a platform-wide (not per-user-local) admin metric.
      countRows('users', (q) => q.is('deleted_at', null).gte('created_at', daysAgoIso(7))),
      countRows('users', (q) => q.is('deleted_at', null).gte('created_at', daysAgoIso(30))),
      countRows('answers', (q) => q.gte('answered_at', todayIso)),
      countRows('answers'),
      countRows('streaks', (q) => q.gt('current_streak', 0)),
      countRows('users', (q) => q.eq('is_premium', true).is('deleted_at', null)),
      // Daily active users needs a distinct user_id count, which PostgREST's
      // head:true count can't express — fetched separately and deduped here.
      supabase
        .from('answers')
        .select('user_id')
        .gte('answered_at', todayIso)
        .then((r) => r.data || []),
    ])

  const usersByType = Object.fromEntries(usersByTypeEntries)
  const totalUsers = Object.values(usersByType).reduce((sum, n) => sum + n, 0)
  const dailyActiveUsers = new Set(todaysAnswerRows.map((r) => r.user_id)).size

  return {
    totalUsers: { all: totalUsers, ...usersByType },
    newSignups: { today: newToday, week: newWeek, month: newMonth },
    dailyActiveUsers,
    questionsAnsweredToday: questionsToday,
    questionsAnsweredAllTime: questionsAllTime,
    activeStreaks,
    premiumUsers,
  }
}

export default createAdminHandler({ method: 'GET', handle })
