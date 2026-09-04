import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { assertIsStudent, getConversationOrThrow, markConversationViewed } from '../_lib/messaging.js'

function validate(body) {
  const conversationId = sanitizeUuid(body.conversation_id)
  if (!conversationId) return { field: 'conversation_id', message: 'conversation_id must be a valid id.' }
  body.conversation_id = conversationId
  return null
}

async function handle({ userId, body }) {
  await assertIsStudent(userId)
  const conversation = await getConversationOrThrow(body.conversation_id, userId)

  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at, read_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
  if (error) throw error

  // Opening the thread is what marks the other participant's messages read
  // — no separate "mark read" call needed, and this is what clears the
  // conversation's unread badge on the next get-conversations fetch.
  const { error: readError } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversation.id)
    .neq('sender_id', userId)
    .is('read_at', null)
  if (readError) throw readError

  // Refreshes this caller's own "currently viewing" heartbeat — see
  // api/_lib/messaging.js's own comment. Best-effort: a failure here
  // shouldn't turn "load my messages" into an error just because a push
  // notification later might not get suppressed.
  markConversationViewed(conversation, userId).catch((err) => console.error('[messages] failed to record conversation view:', err))

  return {
    messages: (messages || []).map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at,
      isMine: m.sender_id === userId,
    })),
  }
}

export default createStudentHandler({ method: 'GET', validate, handle })
