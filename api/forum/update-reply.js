import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeString } from '../_lib/sanitize.js'
import { containsProfanity } from '../../src/lib/profanityFilter.js'

function validate(body) {
  const replyId = sanitizeUuid(body.reply_id)
  if (!replyId) return { field: 'reply_id', message: 'reply_id must be a valid id.' }
  body.reply_id = replyId

  const replyBody = sanitizeString(body.body, 5000)
  if (!replyBody) return { field: 'body', message: 'A reply body is required.' }
  body.body = replyBody

  return null
}

// Author-only, same as update-thread.js — no membership re-check needed
// beyond "is this my own reply," since only the author could have posted
// it in the first place (posting itself is already membership-gated).
async function handle({ userId, body }) {
  const { reply_id: replyId, body: replyBody } = body

  const { data: reply, error: replyError } = await supabase
    .from('forum_replies')
    .select('id, author_id, deleted_at')
    .eq('id', replyId)
    .maybeSingle()
  if (replyError) throw replyError
  if (!reply || reply.deleted_at) {
    const err = new Error('That reply was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (reply.author_id !== userId) {
    const err = new Error('You can only edit your own posts.')
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

  const { data: updated, error } = await supabase
    .from('forum_replies')
    .update({ body: replyBody, edited_at: new Date().toISOString() })
    .eq('id', replyId)
    .select()
    .single()
  if (error) throw error

  return { reply: updated }
}

export default createStudentHandler({ method: 'POST', validate, handle })
