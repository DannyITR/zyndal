import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { fetchLeaderboardRows } from '../_lib/db.js'

// Mirrors getLeaderboard/getFriendsLeaderboard in storage.js. type=friends
// scopes to the caller's own accepted friends (plus themselves); anything
// else (including omitted) returns the global board.
function validate(body) {
  if (body.type !== undefined && body.type !== 'global' && body.type !== 'friends') {
    return "type must be 'global' or 'friends'."
  }
  return null
}

async function handle({ userId, body }) {
  if (body.type === 'friends') {
    const { data, error } = await supabase.from('friends').select('friend_id').eq('user_id', userId)
    if (error) throw error
    const friendIds = (data || []).map((r) => r.friend_id)
    return fetchLeaderboardRows([userId, ...friendIds])
  }
  return fetchLeaderboardRows()
}

export default createStudentHandler({ method: 'GET', validate, handle })
