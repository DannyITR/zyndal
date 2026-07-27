import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeString } from '../_lib/sanitize.js'

// Mirrors searchStudentsByUsername in storage.js, plus one improvement the
// spec explicitly asks for: excluding existing friends, not just the caller
// themselves. The old client-side version let an existing friend show up in
// results with an "Add Friend" button that would just error on click —
// excluding them here is strictly better UX, not just a literal-spec
// checkbox.
//
// This is a partial search query (used in an ilike %...% pattern), not a
// full username — sanitizeString (trim/strip/cap-length), not
// sanitizeUsername, which would wrongly reject a legitimate 1-2 character
// search-in-progress or anything not already lowercase.
function validate(body) {
  const username = sanitizeString(body.username, 20)
  if (!username) return { field: 'username', message: 'username is required.' }
  body.username = username
  return null
}

async function handle({ userId, body }) {
  const { data: friendRows, error: friendError } = await supabase.from('friends').select('friend_id').eq('user_id', userId)
  if (friendError) throw friendError
  const excludeIds = [userId, ...(friendRows || []).map((r) => r.friend_id)]

  const { data, error } = await supabase
    .from('users')
    .select('id, username, grade')
    .eq('account_type', 'student')
    .ilike('username', `%${body.username}%`)
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .limit(10)
  if (error) throw error
  return data || []
}

export default createStudentHandler({ method: 'GET', validate, handle })
