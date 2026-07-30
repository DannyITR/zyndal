import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getTodayScore } from '../_lib/db.js'
import { todayStr, isValidTimeZone, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'

// Backs the home screen's incoming-share notification box and the Friends
// screen's per-friend badge — unlike get-friends.js's receivedToday (which
// returns every share received today regardless of seen_at, feeding
// ShareStreakScreen's unrelated "start a streak" nudge), this only returns
// shares the receiver hasn't marked seen yet, and includes each sender's
// live today's score (not a stored snapshot).
function validate(body) {
  if (body.timezone !== undefined && typeof body.timezone !== 'string') return 'timezone must be a string.'
  return null
}

async function handle({ userId, body }) {
  const timezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE
  const today = todayStr(new Date(), timezone)

  const { data: rows, error } = await supabase
    .from('streak_shares')
    .select('*, users:sender_id(username, avatar, deleted_at)')
    .eq('receiver_id', userId)
    .eq('share_date', today)
    .is('seen_at', null)
    .order('shared_at', { ascending: false })
  if (error) throw error

  const visible = (rows || []).filter((r) => !r.users?.deleted_at)
  const senderIds = [...new Set(visible.map((r) => r.sender_id))]
  const scoresBySender = Object.fromEntries(
    await Promise.all(senderIds.map(async (id) => [id, await getTodayScore(id, timezone)]))
  )

  return visible.map((r) => ({
    id: r.id,
    senderId: r.sender_id,
    senderUsername: r.users?.username || 'Unknown',
    senderAvatar: r.users?.avatar || null,
    senderStreak: r.sender_streak,
    senderScore: scoresBySender[r.sender_id],
  }))
}

export default createStudentHandler({ method: 'GET', validate, handle })
