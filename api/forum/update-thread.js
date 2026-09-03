import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { resolveThreadClass } from '../_lib/forumAuth.js'
import { sanitizeUuid, sanitizeString } from '../_lib/sanitize.js'
import { containsProfanity } from '../../src/lib/profanityFilter.js'

function validate(body) {
  const threadId = sanitizeUuid(body.thread_id)
  if (!threadId) return { field: 'thread_id', message: 'thread_id must be a valid id.' }
  body.thread_id = threadId

  const title = sanitizeString(body.title, 150)
  if (!title) return { field: 'title', message: 'A title is required.' }
  body.title = title

  const threadBody = sanitizeString(body.body, 5000)
  if (!threadBody) return { field: 'body', message: 'A post body is required.' }
  body.body = threadBody

  return null
}

// Author-only — a class member who isn't the author (including the
// class's own teacher) can view and report a thread but never edit it.
async function handle({ userId, body }) {
  const { thread_id: threadId, title, body: threadBody } = body

  const thread = await resolveThreadClass(threadId)
  if (!thread || thread.deleted_at) {
    const err = new Error('That thread was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (thread.author_id !== userId) {
    const err = new Error('You can only edit your own posts.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  if (containsProfanity(title) || containsProfanity(threadBody)) {
    const err = new Error('Your post may contain inappropriate language. Please revise it and try again.')
    err.status = 400
    err.code = 'PROFANITY_DETECTED'
    throw err
  }

  const { data: updated, error } = await supabase
    .from('forum_threads')
    .update({ title, body: threadBody, edited_at: new Date().toISOString() })
    .eq('id', threadId)
    .select()
    .single()
  if (error) throw error

  return { thread: updated }
}

export default createStudentHandler({ method: 'POST', validate, handle })
