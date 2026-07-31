import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeString } from '../_lib/sanitize.js'

// Mirrors searchStudentsByUsername in storage.js, plus excluding existing
// friends and anyone with a pending friend request (either direction) —
// the old client-side version let those show up with a working-looking
// "Add Friend" button that would just error on click.
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

  // Pending requests in EITHER direction — a receiver-side pending request
  // would otherwise show up here with a working-looking "Add Friend"
  // button that fails server-side (friend-request.js's own
  // findExistingFriendRequest blocks a second request either way).
  const { data: pendingRows, error: pendingError } = await supabase
    .from('friend_requests')
    .select('sender_id, receiver_id')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq('status', 'pending')
  if (pendingError) throw pendingError
  const pendingIds = (pendingRows || []).map((r) => (r.sender_id === userId ? r.receiver_id : r.sender_id))

  const excludeIds = [userId, ...(friendRows || []).map((r) => r.friend_id), ...pendingIds]

  const { data, error } = await supabase
    .from('users')
    .select('id, username, grade, avatar')
    .eq('account_type', 'student')
    .is('deleted_at', null)
    .ilike('username', `%${body.username}%`)
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .limit(5)
  if (error) throw error
  return data || []
}

export default createStudentHandler({ method: 'GET', validate, handle })
