import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

function validate(body) {
  const replyId = sanitizeUuid(body.reply_id)
  if (!replyId) return { field: 'reply_id', message: 'reply_id must be a valid id.' }
  body.reply_id = replyId
  return null
}

// Soft delete, same as delete-thread.js — the row stays, get-thread.js
// filters it out of the returned replies list, and admin/teacher
// moderation can still see it via resolveReportTargetClass.
async function handle({ userId, body }) {
  const { reply_id: replyId } = body

  const { data: reply, error: replyError } = await supabase.from('forum_replies').select('id, author_id, deleted_at').eq('id', replyId).maybeSingle()
  if (replyError) throw replyError
  if (!reply || reply.deleted_at) {
    const err = new Error('That reply was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (reply.author_id !== userId) {
    const err = new Error('You can only delete your own posts.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  const { error } = await supabase.from('forum_replies').update({ deleted_at: new Date().toISOString() }).eq('id', replyId)
  if (error) throw error

  return { success: true }
}

export default createStudentHandler({ method: 'POST', validate, handle })
