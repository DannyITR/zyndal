import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getForumMembership } from '../_lib/forumAuth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

// Built on createStudentHandler (any authenticated user, not just students —
// see that file's own comment) since a class forum's real membership check
// below is what actually gates access; a parent/admin session naturally has
// no membership row anywhere, so no separate account_type check is needed.
function validate(body) {
  if (body.class_type !== 'group' && body.class_type !== 'class') return { field: 'class_type', message: 'class_type must be "group" or "class".' }
  const classId = sanitizeUuid(body.class_id)
  if (!classId) return { field: 'class_id', message: 'class_id must be a valid id.' }
  body.class_id = classId
  return null
}

async function handle({ userId, body }) {
  const { class_type: classType, class_id: classId } = body

  const membership = await getForumMembership(userId, classType, classId)
  if (!membership.member) {
    const err = new Error('You are not a member of this class.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  const { data: threads, error } = await supabase
    .from('forum_threads')
    .select('id, author_id, title, created_at')
    .eq('class_type', classType)
    .eq('class_id', classId)
    .is('deleted_at', null)
  if (error) throw error

  if ((threads || []).length === 0) return { threads: [] }

  const threadIds = threads.map((t) => t.id)
  const { data: replies, error: repliesError } = await supabase
    .from('forum_replies')
    .select('thread_id, created_at')
    .in('thread_id', threadIds)
    .is('deleted_at', null)
  if (repliesError) throw repliesError

  const replyStatsByThread = {}
  for (const r of replies || []) {
    const stat = (replyStatsByThread[r.thread_id] ??= { count: 0, lastAt: null })
    stat.count += 1
    if (!stat.lastAt || r.created_at > stat.lastAt) stat.lastAt = r.created_at
  }

  const authorIds = [...new Set(threads.map((t) => t.author_id))]
  const { data: authors, error: authorsError } = await supabase.from('users').select('id, username').in('id', authorIds)
  if (authorsError) throw authorsError
  const usernameById = Object.fromEntries((authors || []).map((a) => [a.id, a.username]))

  const enriched = threads.map((t) => {
    const stat = replyStatsByThread[t.id]
    return {
      id: t.id,
      title: t.title,
      authorUsername: usernameById[t.author_id] || 'Unknown',
      createdAt: t.created_at,
      replyCount: stat?.count || 0,
      lastActivityAt: stat?.lastAt || t.created_at,
    }
  })
  enriched.sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1))

  return { threads: enriched }
}

export default createStudentHandler({ method: 'GET', validate, handle })
