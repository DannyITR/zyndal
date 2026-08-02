import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getStreakRow, getTodayScore } from '../_lib/db.js'
import { insertNotification } from '../_lib/notifications.js'
import { notificationText } from '../_lib/notificationText.js'
import { sendPushToUser } from '../_lib/push.js'
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

  // Server-side only, no exceptions — a friend having already shared with
  // this user does NOT bypass it. The client used to gate this on subjects
  // merely attempted (some possibly wrong), which let an incomplete/wrong
  // day's score through; this is the actual source of truth now.
  if (senderScore.correct < senderScore.total) {
    const err = new Error('Complete all 6 subjects today before sharing your score')
    err.status = 400
    err.code = 'INCOMPLETE_DAY'
    throw err
  }

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
    const [{ data: sender }, { data: receiver }] = await Promise.all([
      supabase.from('users').select('username').eq('id', userId).maybeSingle(),
      supabase.from('users').select('language_preference').eq('id', body.receiver_id).maybeSingle(),
    ])
    const senderUsername = sender?.username || 'Someone'
    const { title, body: notifBody } = notificationText('score_share', receiver?.language_preference, {
      senderUsername,
      correct: senderScore.correct,
      total: senderScore.total,
    })
    await insertNotification({
      userId: body.receiver_id,
      type: 'score_share',
      title,
      body: notifBody,
      data: { share_id: shareRow.id, sender_id: userId, sender_username: senderUsername, sender_score: senderScore },
    })

    // Push is a second, independent alert layer — the notifications-table
    // write above always happens regardless of push settings/subscription
    // state; sendPushToUser handles its own "skip silently" cases
    // (disabled, no subscription, etc.) and never throws.
    await sendPushToUser({
      userId: body.receiver_id,
      type: 'score_share',
      title: `🔥 @${senderUsername} shared their score with you!`,
      body: `They got ${senderScore.correct}/${senderScore.total} today — share yours back to keep your streak alive`,
      url: 'https://zyndal.ca',
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
