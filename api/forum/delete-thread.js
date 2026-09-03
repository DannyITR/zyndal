import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { resolveThreadClass } from '../_lib/forumAuth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

function validate(body) {
  const threadId = sanitizeUuid(body.thread_id)
  if (!threadId) return { field: 'thread_id', message: 'thread_id must be a valid id.' }
  body.thread_id = threadId
  return null
}

// Soft delete only — deleted_at is set, the row (and every reply under it)
// stays in the database. get-threads.js/get-thread.js hide anything with
// deleted_at set from the normal list/detail view (a deleted thread hides
// its replies too, just by refusing to serve the thread at all — no need
// to touch each reply's own deleted_at), while
// admin/teacher get-forum-reports.js still surface it via
// resolveReportTargetClass for moderation review.
async function handle({ userId, body }) {
  const { thread_id: threadId } = body

  const thread = await resolveThreadClass(threadId)
  if (!thread || thread.deleted_at) {
    const err = new Error('That thread was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (thread.author_id !== userId) {
    const err = new Error('You can only delete your own posts.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  const { error } = await supabase.from('forum_threads').update({ deleted_at: new Date().toISOString() }).eq('id', threadId)
  if (error) throw error

  return { success: true }
}

export default createStudentHandler({ method: 'POST', validate, handle })
