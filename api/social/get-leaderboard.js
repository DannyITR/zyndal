import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getEffectiveStreak, todayStr } from '../../src/lib/streak.js'

// Mirrors fetchLeaderboardRows/getLeaderboard/getFriendsLeaderboard in
// storage.js. type=friends scopes to the caller's own accepted friends (plus
// themselves); anything else (including omitted) returns the global board.
function validate(body) {
  if (body.type !== undefined && body.type !== 'global' && body.type !== 'friends') {
    return "type must be 'global' or 'friends'."
  }
  return null
}

async function fetchLeaderboardRows(userIds) {
  let query = supabase
    .from('streaks')
    .select('current_streak, total_xp, last_answered_date, user_id, users:user_id(username, grade, account_type, deleted_at)')
    .order('total_xp', { ascending: false })
  if (userIds) query = query.in('user_id', userIds)

  const { data, error } = await query
  if (error) throw error

  const today = todayStr()
  return (data || [])
    .filter((row) => row.users?.account_type === 'student' && !row.users?.deleted_at)
    .map((row) => ({
      userId: row.user_id,
      username: row.users.username,
      grade: row.users.grade,
      xp: row.total_xp,
      streak: getEffectiveStreak({ streak: row.current_streak, lastCorrectDate: row.last_answered_date }, today),
    }))
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
