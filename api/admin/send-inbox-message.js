import { createAdminHandler } from '../_lib/adminHandler.js'
import { sanitizeUuid, sanitizeString } from '../_lib/sanitize.js'
import { getConversationOrThrow, sendMessageInConversation } from '../_lib/messaging.js'

function validate(body) {
  const conversationId = sanitizeUuid(body.conversation_id)
  if (!conversationId) return { field: 'conversation_id', message: 'conversation_id must be a valid id.' }
  body.conversation_id = conversationId

  const messageBody = sanitizeString(body.body, 2000)
  if (!messageBody) return { field: 'body', message: 'A message body is required.' }
  body.body = messageBody

  return null
}

// skipSafetyScreening: true — admin messages are exempt from the AI safety
// screen per spec (the profanity filter inside sendMessageInConversation
// still applies uniformly, admin included).
async function handle({ adminId, body }) {
  const { conversation_id: conversationId, body: messageBody } = body
  const conversation = await getConversationOrThrow(conversationId, adminId)
  return sendMessageInConversation({ conversation, senderId: adminId, body: messageBody, skipSafetyScreening: true })
}

export default createAdminHandler({ method: 'POST', validate, handle })
