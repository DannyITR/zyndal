import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getForumMembership, resolveThreadClass } from '../_lib/forumAuth.js'
import { sanitizeUuid, sanitizeString } from '../_lib/sanitize.js'
import { containsProfanity } from '../../src/lib/profanityFilter.js'
import { notificationText } from '../_lib/notificationText.js'
import { insertNotification } from '../_lib/notifications.js'
import { sendPushToUser } from '../_lib/push.js'

function validate(body) {
  const threadId = sanitizeUuid(body.thread_id)
  if (!threadId) return { field: 'thread_id', message: 'thread_id must be a valid id.' }
  body.thread_id = threadId

  const replyBody = sanitizeString(body.body, 5000)
  if (!replyBody) return { field: 'body', message: 'A reply body is required.' }
  body.body = replyBody

  return null
}

async function handle({ userId, body }) {
  const { thread_id: threadId, body: replyBody } = body

  const thread = await resolveThreadClass(threadId)
  // Same treatment as get-thread.js — a soft-deleted thread is not-found
  // for a normal reply attempt too, not just for reading it.
  if (!thread || thread.deleted_at) {
    const err = new Error('That thread was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const membership = await getForumMembership(userId, thread.class_type, thread.class_id)
  if (!membership.member) {
    const err = new Error('You are not a member of this class.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  if (containsProfanity(replyBody)) {
    const err = new Error('Your reply may contain inappropriate language. Please revise it and try again.')
    err.status = 400
    err.code = 'PROFANITY_DETECTED'
    throw err
  }

  const { data: reply, error } = await supabase.from('forum_replies').insert({ thread_id: threadId, author_id: userId, body: replyBody }).select().single()
  if (error) throw error

  // Best-effort — a failed notification never fails the reply itself.
  // Never notify the thread author replying to their own thread.
  if (thread.author_id !== userId) {
    try {
      const [{ data: replier }, { data: author }] = await Promise.all([
        supabase.from('users').select('username').eq('id', userId).maybeSingle(),
        supabase.from('users').select('language_preference').eq('id', thread.author_id).maybeSingle(),
      ])
      const replierUsername = replier?.username || 'Someone'
      const params = { replierUsername, threadTitle: thread.title }

      // No PUSH_TEMPLATES entry for forum_reply — reuses the same in-app
      // copy for the push notification, same as every other type that
      // doesn't need its own distinct push wording (see notificationText.js's
      // own comment on PUSH_TEMPLATES).
      const { title, body: notifBody } = notificationText('forum_reply', author?.language_preference, params)
      await insertNotification({
        userId: thread.author_id,
        type: 'forum_reply',
        title,
        body: notifBody,
        data: { thread_id: threadId, reply_id: reply.id },
      })

      await sendPushToUser({ userId: thread.author_id, type: 'forum_reply', title, body: notifBody, url: 'https://zyndal.ca' })
    } catch (err) {
      console.error('[forum] failed to notify thread author of new reply:', err)
    }
  }

  return { reply }
}

export default createStudentHandler({ method: 'POST', validate, handle })
