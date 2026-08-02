import { createParentHandler } from '../_lib/parentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeString } from '../_lib/sanitize.js'

// Mirrors api/social/search-users.js's shape, but for the parent "Add
// Child" flow instead of student friend-search: excludes students who
// already have ANY parent linked (a student can only ever have one — see
// api/_lib/db.js's getLinkedParent, which .maybeSingle()s on student_id)
// rather than excluding this parent's own existing friends/requests, which
// don't apply here.
function validate(body) {
  const username = sanitizeString(body.username, 20)
  if (!username) return { field: 'username', message: 'username is required.' }
  body.username = username
  return null
}

async function handle({ body }) {
  const { data: linkedRows, error: linkedError } = await supabase.from('parent_student').select('student_id')
  if (linkedError) throw linkedError
  const linkedIds = (linkedRows || []).map((r) => r.student_id)

  let query = supabase
    .from('users')
    .select('id, username, grade, avatar')
    .eq('account_type', 'student')
    .is('deleted_at', null)
    .ilike('username', `%${body.username}%`)
    .limit(5)
  if (linkedIds.length > 0) query = query.not('id', 'in', `(${linkedIds.join(',')})`)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export default createParentHandler({ method: 'GET', validate, handle })
