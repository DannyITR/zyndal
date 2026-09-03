import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getForumMembership, resolveThreadClass } from '../_lib/forumAuth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

function validate(body) {
  const threadId = sanitizeUuid(body.thread_id)
  if (!threadId) return { field: 'thread_id', message: 'thread_id must be a valid id.' }
  body.thread_id = threadId
  return null
}

async function handle({ userId, body }) {
  const thread = await resolveThreadClass(body.thread_id)
  // A soft-deleted thread is treated as not-found for every normal reader —
  // deleting a thread hides all of its replies too, simply by refusing to
  // serve the thread at all (no need to also mark each reply deleted).
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

  const { data: replies, error: repliesError } = await supabase
    .from('forum_replies')
    .select('id, author_id, body, created_at, edited_at')
    .eq('thread_id', thread.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (repliesError) throw repliesError

  const authorIds = [...new Set([thread.author_id, ...(replies || []).map((r) => r.author_id)])]
  const { data: authors, error: authorsError } = await supabase.from('users').select('id, username').in('id', authorIds)
  if (authorsError) throw authorsError
  const usernameById = Object.fromEntries((authors || []).map((a) => [a.id, a.username]))

  return {
    thread: {
      id: thread.id,
      title: thread.title,
      body: thread.body,
      authorUsername: usernameById[thread.author_id] || 'Unknown',
      createdAt: thread.created_at,
      editedAt: thread.edited_at,
      isAuthor: thread.author_id === userId,
    },
    replies: (replies || []).map((r) => ({
      id: r.id,
      body: r.body,
      authorUsername: usernameById[r.author_id] || 'Unknown',
      createdAt: r.created_at,
      editedAt: r.edited_at,
      isAuthor: r.author_id === userId,
    })),
  }
}

export default createStudentHandler({ method: 'GET', validate, handle })
