import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { insertNotification } from '../_lib/notifications.js'
import { notificationText } from '../_lib/notificationText.js'
import { sendPushToUser } from '../_lib/push.js'
import { POKE_PRESET_KEYS } from '../../src/lib/pokePresets.js'

// Rolling 24h window rather than a calendar-day boundary — unlike
// submit-answer.js/submit-late-answer.js, a poke isn't tied to "today's
// question" in any student-timezone-sensitive way, so there's no reason to
// make the client send a timezone just to gate a casual nudge. "4 per
// friend per day" reads fine as "4 per friend per rolling 24h" in practice.
const POKE_DAILY_LIMIT = 4
const POKE_WINDOW_MS = 24 * 60 * 60 * 1000

function validate(body) {
  if (!body.receiver_id || typeof body.receiver_id !== 'string') return 'receiver_id is required.'
  if (!POKE_PRESET_KEYS.includes(body.preset_key)) return 'preset_key must be one of the preset poke messages.'
  return null
}

async function handle({ userId, body }) {
  const { receiver_id: receiverId, preset_key: presetKey } = body

  if (receiverId === userId) {
    const err = new Error("You can't poke yourself.")
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  // Pokes are friends-only — the UI only ever offers the button next to an
  // actual friend, but this is re-checked server-side the same way
  // friend-request.js/share-score.js never trust the client alone for
  // anything that grants access to another user's notifications.
  const { data: friendRow, error: friendError } = await supabase
    .from('friends')
    .select('id')
    .eq('user_id', userId)
    .eq('friend_id', receiverId)
    .maybeSingle()
  if (friendError) throw friendError
  if (!friendRow) {
    const err = new Error('You can only poke friends.')
    err.status = 403
    err.code = 'NOT_FRIENDS'
    throw err
  }

  const windowStart = new Date(Date.now() - POKE_WINDOW_MS).toISOString()
  const { count, error: countError } = await supabase
    .from('pokes')
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', userId)
    .eq('receiver_id', receiverId)
    .gte('created_at', windowStart)
  if (countError) throw countError
  if ((count || 0) >= POKE_DAILY_LIMIT) {
    const err = new Error("You've already poked this friend the max number of times today.")
    err.status = 429
    err.code = 'POKE_LIMIT_REACHED'
    throw err
  }

  const { error: insertError } = await supabase.from('pokes').insert({ sender_id: userId, receiver_id: receiverId, preset_key: presetKey })
  if (insertError) throw insertError

  const [{ data: sender }, { data: receiver }] = await Promise.all([
    supabase.from('users').select('username').eq('id', userId).maybeSingle(),
    supabase.from('users').select('language_preference').eq('id', receiverId).maybeSingle(),
  ])
  const senderUsername = sender?.username || 'Someone'
  const { title, body: notifBody } = notificationText('poke', receiver?.language_preference, { senderUsername, presetKey })
  await insertNotification({
    userId: receiverId,
    type: 'poke',
    title,
    body: notifBody,
    data: { sender_id: userId, sender_username: senderUsername, preset_key: presetKey },
  })
  await sendPushToUser({ userId: receiverId, type: 'poke', title, body: notifBody, url: 'https://zyndal.ca' })

  return { sent: true, remaining_today: POKE_DAILY_LIMIT - (count || 0) - 1 }
}

export default createStudentHandler({ method: 'POST', validate, handle })
