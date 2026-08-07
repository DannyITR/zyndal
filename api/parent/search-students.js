import { createParentHandler } from '../_lib/parentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeString } from '../_lib/sanitize.js'

// Mirrors api/social/search-users.js's shape, but for the parent "Add
// Child" flow instead of student friend-search: excludes students who
// already have the maximum 2 linked parents, rather than excluding this
// parent's own existing friends/requests, which don't apply here. A
// student with 0 or 1 linked parents still shows up — link-request.js is
// what actually enforces the cap (and the "already linked to me
// specifically" case) at request time.
function validate(body) {
  const username = sanitizeString(body.username, 20)
  if (!username) return { field: 'username', message: 'username is required.' }
  body.username = username
  return null
}

async function handle({ body }) {
  const { data: linkedRows, error: linkedError } = await supabase.from('parent_student').select('student_id')
  if (linkedError) throw linkedError
  const linkCountByStudent = {}
  for (const row of linkedRows || []) linkCountByStudent[row.student_id] = (linkCountByStudent[row.student_id] || 0) + 1
  const fullyLinkedIds = Object.keys(linkCountByStudent).filter((id) => linkCountByStudent[id] >= 2)

  let query = supabase
    .from('users')
    .select('id, username, grade, avatar')
    .eq('account_type', 'student')
    .is('deleted_at', null)
    .ilike('username', `%${body.username}%`)
    .limit(5)
  if (fullyLinkedIds.length > 0) query = query.not('id', 'in', `(${fullyLinkedIds.join(',')})`)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export default createParentHandler({ method: 'GET', validate, handle })
