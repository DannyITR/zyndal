import { createAdminHandler } from '../_lib/adminHandler.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { getConversationOrThrow, listMessagesInConversation } from '../_lib/messaging.js'

function validate(body) {
  const conversationId = sanitizeUuid(body.conversation_id)
  if (!conversationId) return { field: 'conversation_id', message: 'conversation_id must be a valid id.' }
  body.conversation_id = conversationId
  return null
}

async function handle({ adminId, body }) {
  const conversation = await getConversationOrThrow(body.conversation_id, adminId)
  return listMessagesInConversation(conversation, adminId)
}

export default createAdminHandler({ method: 'GET', validate, handle })
