import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getForumMembership } from '../_lib/forumAuth.js'
import { sanitizeUuid, sanitizeString } from '../_lib/sanitize.js'
import { containsProfanity } from '../../src/lib/profanityFilter.js'

function validate(body) {
  if (body.class_type !== 'group' && body.class_type !== 'class') return { field: 'class_type', message: 'class_type must be "group" or "class".' }
  const classId = sanitizeUuid(body.class_id)
  if (!classId) return { field: 'class_id', message: 'class_id must be a valid id.' }
  body.class_id = classId

  const title = sanitizeString(body.title, 150)
  if (!title) return { field: 'title', message: 'A title is required.' }
  body.title = title

  const threadBody = sanitizeString(body.body, 5000)
  if (!threadBody) return { field: 'body', message: 'A post body is required.' }
  body.body = threadBody

  return null
}

async function handle({ userId, body }) {
  const { class_type: classType, class_id: classId, title, body: threadBody } = body

  const membership = await getForumMembership(userId, classType, classId)
  if (!membership.member) {
    const err = new Error('You are not a member of this class.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  // Authoritative check — the client runs the same containsProfanity()
  // before ever submitting (see NewThreadModal.jsx), but that's only a
  // fast-fail UX nicety, never trusted alone.
  if (containsProfanity(title) || containsProfanity(threadBody)) {
    const err = new Error('Your post may contain inappropriate language. Please revise it and try again.')
    err.status = 400
    err.code = 'PROFANITY_DETECTED'
    throw err
  }

  const { data: thread, error } = await supabase
    .from('forum_threads')
    .insert({ class_type: classType, class_id: classId, author_id: userId, title, body: threadBody })
    .select()
    .single()
  if (error) throw error

  return { thread }
}

export default createStudentHandler({ method: 'POST', validate, handle })
