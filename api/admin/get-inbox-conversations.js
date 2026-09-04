import { createAdminHandler } from '../_lib/adminHandler.js'
import { listConversationsForUser } from '../_lib/messaging.js'

// Admin's OWN conversations (as a participant) — distinct from
// api/admin/get-messages.js, which is a read-only platform-wide browse of
// every message on the app, unrelated to this. Thin wrapper over the same
// shared core api/messages/get-conversations.js uses, keyed on the calling
// admin's own id instead of a regular session's userId.
async function handle({ adminId }) {
  return listConversationsForUser(adminId)
}

export default createAdminHandler({ method: 'GET', handle })
