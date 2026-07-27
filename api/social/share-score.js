import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getStreakRow } from '../_lib/db.js'
import { getEffectiveStreak, todayStr } from '../../src/lib/streak.js'
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
  const today = todayStr()
  const streakRow = await getStreakRow(userId)
  const senderStreak = getEffectiveStreak({ streak: streakRow.current_streak, lastCorrectDate: streakRow.last_answered_date }, today)

  const { error } = await supabase.from('streak_shares').insert({
    sender_id: userId,
    receiver_id: body.receiver_id,
    sender_streak: senderStreak,
    share_date: today,
  })
  if (error && error.code !== '23505') throw error // 23505 = already shared with this friend today

  const { data: shares, error: sharesError } = await supabase
    .from('streak_shares')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
  if (sharesError) throw sharesError

  return { shareStreak: computeShareStreak(shares || [], userId, body.receiver_id, today) }
}

export default createStudentHandler({ method: 'POST', validate, handle })
