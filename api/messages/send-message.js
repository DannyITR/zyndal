import { waitUntil } from '@vercel/functions'
import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeString } from '../_lib/sanitize.js'
import { assertIsStudent, getConversationOrThrow } from '../_lib/messaging.js'
import { containsProfanity } from '../../src/lib/profanityFilter.js'
import { screenMessageSafety } from '../_lib/messageSafety.js'
import { notificationText } from '../_lib/notificationText.js'
import { insertNotification } from '../_lib/notifications.js'
import { sendPushToUser } from '../_lib/push.js'

function validate(body) {
  const conversationId = sanitizeUuid(body.conversation_id)
  if (!conversationId) return { field: 'conversation_id', message: 'conversation_id must be a valid id.' }
  body.conversation_id = conversationId

  const messageBody = sanitizeString(body.body, 2000)
  if (!messageBody) return { field: 'body', message: 'A message body is required.' }
  body.body = messageBody

  return null
}

async function handle({ userId, body }) {
  const { conversation_id: conversationId, body: messageBody } = body

  await assertIsStudent(userId)
  const conversation = await getConversationOrThrow(conversationId, userId)

  // Same block-and-warn behavior as api/forum/create-thread.js — the client
  // runs the same containsProfanity() check before ever submitting, but
  // this is the authoritative check.
  if (containsProfanity(messageBody)) {
    const err = new Error('Your message may contain inappropriate language. Please revise it and try again.')
    err.status = 400
    err.code = 'PROFANITY_DETECTED'
    throw err
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: userId, body: messageBody })
    .select()
    .single()
  if (error) throw error

  // Fire-and-forget via waitUntil (same pattern as api/_lib/dailyQuestion.js's
  // background pool generation) — the message is already inserted and about
  // to be delivered/notified below, so this AI screening pass runs after
  // the response is sent and never adds latency to sending a message,
  // regardless of how long the Claude call takes.
  waitUntil(screenMessageSafety(message.id, messageBody).catch((err) => console.error('[messages] safety screening failed:', err)))

  const recipientId = conversation.user_a_id === userId ? conversation.user_b_id : conversation.user_a_id

  // Best-effort — a failed notification never fails the message itself.
  try {
    const [{ data: sender }, { data: recipient }] = await Promise.all([
      supabase.from('users').select('username').eq('id', userId).maybeSingle(),
      supabase.from('users').select('language_preference').eq('id', recipientId).maybeSingle(),
    ])
    const senderUsername = sender?.username || 'Someone'
    const bodyPreview = messageBody.length > 80 ? `${messageBody.slice(0, 80)}…` : messageBody
    const params = { senderUsername, bodyPreview }

    const { title, body: notifBody } = notificationText('message_received', recipient?.language_preference, params)
    await insertNotification({
      userId: recipientId,
      type: 'message_received',
      title,
      body: notifBody,
      data: { conversation_id: conversationId, message_id: message.id },
    })

    await sendPushToUser({ userId: recipientId, type: 'message_received', title, body: notifBody, url: 'https://zyndal.ca' })
  } catch (err) {
    console.error('[messages] failed to notify recipient of new message:', err)
  }

  return { message }
}

export default createStudentHandler({ method: 'POST', validate, handle })
