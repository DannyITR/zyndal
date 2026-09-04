import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { verifyConversationAllowed, findOrCreateConversation } from '../_lib/messaging.js'

// Admin can message any user on the platform — from the admin user list
// or directly from a flagged message/report (AdminDashboard.jsx /
// AdminReportsScreen.jsx both call this with the target user's id).
// verifyConversationAllowed still runs for consistency with every other
// conversation-creation path, even though the "admin is one side" branch
// always allows it.
function validate(body) {
  const targetUserId = sanitizeUuid(body.target_user_id)
  if (!targetUserId) return { field: 'target_user_id', message: 'target_user_id must be a valid id.' }
  body.target_user_id = targetUserId
  return null
}

async function handle({ adminId, body }) {
  const { target_user_id: targetUserId } = body
  if (targetUserId === adminId) {
    const err = new Error("You can't message yourself.")
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  await verifyConversationAllowed(adminId, targetUserId)
  const conversation = await findOrCreateConversation(adminId, targetUserId)

  const { data: otherUser, error: otherUserError } = await supabase
    .from('users')
    .select('id, username, avatar, account_type')
    .eq('id', targetUserId)
    .maybeSingle()
  if (otherUserError) throw otherUserError

  return {
    conversation,
    otherUser: otherUser
      ? { id: otherUser.id, username: otherUser.username, avatar: otherUser.avatar, isAdmin: otherUser.account_type === 'admin' }
      : null,
  }
}

export default createAdminHandler({ method: 'POST', validate, handle })
