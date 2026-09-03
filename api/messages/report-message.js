import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeString } from '../_lib/sanitize.js'
import { assertIsStudent, getConversationOrThrow } from '../_lib/messaging.js'

function validate(body) {
  const messageId = sanitizeUuid(body.message_id)
  if (!messageId) return { field: 'message_id', message: 'message_id must be a valid id.' }
  body.message_id = messageId

  const reason = sanitizeString(body.reason, 500)
  if (!reason) return { field: 'reason', message: 'A reason is required.' }
  body.reason = reason

  return null
}

async function handle({ userId, body }) {
  const { message_id: messageId, reason } = body

  await assertIsStudent(userId)

  const { data: message, error: messageError } = await supabase.from('messages').select('id, conversation_id').eq('id', messageId).maybeSingle()
  if (messageError) throw messageError
  if (!message) {
    const err = new Error('That message was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  // Confirms the reporter is actually a participant in this message's
  // conversation before letting them report it.
  await getConversationOrThrow(message.conversation_id, userId)

  const { data: report, error } = await supabase
    .from('message_reports')
    .insert({ target_type: 'message', target_id: messageId, reporter_id: userId, reason, status: 'pending' })
    .select()
    .single()
  if (error) throw error

  return { report }
}

export default createStudentHandler({ method: 'POST', validate, handle })
