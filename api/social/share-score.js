import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getStreakRow, getTodayScore } from '../_lib/db.js'
import { insertNotification } from '../_lib/notifications.js'
import { getEffectiveStreak, todayStr, isValidTimeZone, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'
import { computeShareStreak } from '../../src/lib/streakShare.js'

// Mirrors shareStreakWithFriend in storage.js. sender_streak isn't accepted
// from the client (the literal spec's { receiver_id }-only body already
// implies this) — the server derives the caller's own current streak from
// their streaks row, the same way submit-answer.js derives correctness
// server-side rather than trusting client-supplied game state.
function validate(body) {
  if (!body.receiver_id || typeof body.receiver_id !== 'string') return 'receiver_id is required.'
  return null
}

async function handle({ userId, body }) {
  // One timezone-aware "today" for the whole endpoint — this used to call
  // the zero-arg (UTC-only) todayStr() for both the share_date insert and
  // computeShareStreak, inconsistent with the rest of the app's
  // timezone-aware "today" handling (see submit-answer.js). Now unified.
  const timezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE
  const today = todayStr(new Date(), timezone)

  const streakRow = await getStreakRow(userId)
  const senderStreak = getEffectiveStreak({ streak: streakRow.current_streak, lastCorrectDate: streakRow.last_answered_date }, today)
  const senderScore = await getTodayScore(userId, timezone)

  const { data: shareRow, error } = await supabase
    .from('streak_shares')
    .insert({
      sender_id: userId,
      receiver_id: body.receiver_id,
      sender_streak: senderStreak,
      share_date: today,
    })
    .select()
    .single()
  if (error && error.code !== '23505') throw error // 23505 = already shared with this friend today

  // Only notify on an actual new share, not a same-day duplicate (the
  // 23505 path above leaves shareRow undefined).
  if (shareRow) {
    const { data: sender } = await supabase.from('users').select('username').eq('id', userId).maybeSingle()
    const senderUsername = sender?.username || 'Someone'
    await insertNotification({
      userId: body.receiver_id,
      type: 'score_share',
      title: `@${senderUsername} shared their score`,
      body: `@${senderUsername} got ${senderScore.correct}/${senderScore.total} today`,
      data: { share_id: shareRow.id, sender_id: userId, sender_username: senderUsername, sender_score: senderScore },
    })
  }

  const { data: shares, error: sharesError } = await supabase
    .from('streak_shares')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
  if (sharesError) throw sharesError

  return { shareStreak: computeShareStreak(shares || [], userId, body.receiver_id, today), sender_score: senderScore }
}

export default createStudentHandler({ method: 'POST', validate, handle })
