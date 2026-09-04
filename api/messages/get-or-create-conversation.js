import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { verifyConversationAllowed, findOrCreateConversation } from '../_lib/messaging.js'

// other_user_id, not friend_id — this is no longer friends-only. Any
// account type can call this; verifyConversationAllowed is what decides
// whether THIS specific pairing is allowed (friends for two students, a
// parent-child link, a parent and their child's teacher, or admin with
// anyone — see api/_lib/messaging.js).
function validate(body) {
  const otherUserId = sanitizeUuid(body.other_user_id)
  if (!otherUserId) return { field: 'other_user_id', message: 'other_user_id must be a valid id.' }
  body.other_user_id = otherUserId
  return null
}

async function handle({ userId, body }) {
  const { other_user_id: otherUserId } = body
  if (otherUserId === userId) {
    const err = new Error("You can't message yourself.")
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  await verifyConversationAllowed(userId, otherUserId)
  const conversation = await findOrCreateConversation(userId, otherUserId)

  const { data: otherUser, error: otherUserError } = await supabase
    .from('users')
    .select('id, username, avatar, account_type')
    .eq('id', otherUserId)
    .maybeSingle()
  if (otherUserError) throw otherUserError

  return {
    conversation,
    otherUser: otherUser
      ? { id: otherUser.id, username: otherUser.username, avatar: otherUser.avatar, isAdmin: otherUser.account_type === 'admin' }
      : null,
  }
}

export default createStudentHandler({ method: 'POST', validate, handle })
