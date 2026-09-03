import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { assertIsStudent, verifyFriendship, sortPairIds } from '../_lib/messaging.js'

function validate(body) {
  const friendId = sanitizeUuid(body.friend_id)
  if (!friendId) return { field: 'friend_id', message: 'friend_id must be a valid id.' }
  body.friend_id = friendId
  return null
}

async function handle({ userId, body }) {
  const { friend_id: friendId } = body
  if (friendId === userId) {
    const err = new Error("You can't message yourself.")
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  await assertIsStudent(userId)
  await assertIsStudent(friendId)
  await verifyFriendship(userId, friendId)

  const [userAId, userBId] = sortPairIds(userId, friendId)

  const { data: existing, error: existingError } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_a_id', userAId)
    .eq('user_b_id', userBId)
    .maybeSingle()
  if (existingError) throw existingError

  let conversation = existing
  if (!conversation) {
    const { data: inserted, error: insertError } = await supabase
      .from('conversations')
      .insert({ user_a_id: userAId, user_b_id: userBId })
      .select()
      .single()
    if (insertError) {
      // Another request created the same pair first — read back the
      // winner instead of erroring, same pattern as
      // api/curriculum/get-outline.js's own 23505 handling.
      if (insertError.code === '23505') {
        const { data: winner, error: refetchError } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_a_id', userAId)
          .eq('user_b_id', userBId)
          .maybeSingle()
        if (refetchError) throw refetchError
        conversation = winner
      } else {
        throw insertError
      }
    } else {
      conversation = inserted
    }
  }

  const { data: otherUser, error: otherUserError } = await supabase.from('users').select('id, username, avatar').eq('id', friendId).maybeSingle()
  if (otherUserError) throw otherUserError

  return { conversation, otherUser }
}

export default createStudentHandler({ method: 'POST', validate, handle })
