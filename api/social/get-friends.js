import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getEffectiveStreak, todayStr } from '../../src/lib/streak.js'

// Combines getFriendsWithStreaks, getPendingFriendRequests,
// getStreakSharesForUser, and getTodaysReceivedShares from storage.js into
// one round trip — FriendsScreen and ShareStreakScreen each already fetch
// several of these together via Promise.all on mount, so storage.js caches
// this response and slices it per-function the same way get-dashboard.js
// does for the parent screens. getPendingFriendRequests only ever returned
// received requests before; `sent` is added here since the spec explicitly
// asks for both directions, even though nothing currently renders it.
async function getFriendIds(userId) {
  const { data, error } = await supabase.from('friends').select('friend_id').eq('user_id', userId)
  if (error) throw error
  return (data || []).map((r) => r.friend_id)
}

// Deleted accounts are excluded (not just filtered from the result — the
// query itself skips them), so a pending request from/to one falls back to
// the existing 'Unknown' handling below rather than surfacing anything
// about a deactivated account.
async function usernameLookup(userIds) {
  if (userIds.length === 0) return {}
  const { data, error } = await supabase.from('users').select('id, username').in('id', userIds).is('deleted_at', null)
  if (error) throw error
  return Object.fromEntries((data || []).map((u) => [u.id, u.username]))
}

async function handle({ userId }) {
  const friendIds = await getFriendIds(userId)

  const [friendRows, receivedRequests, sentRequests, shareRows, receivedTodayRows] = await Promise.all([
    friendIds.length === 0
      ? Promise.resolve([])
      : supabase
          .from('streaks')
          .select('user_id, current_streak, last_answered_date, users:user_id(username, grade, avatar, deleted_at)')
          .in('user_id', friendIds)
          .then((r) => {
            if (r.error) throw r.error
            return r.data || []
          }),
    supabase
      .from('friend_requests')
      .select('*')
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then((r) => {
        if (r.error) throw r.error
        return r.data || []
      }),
    supabase
      .from('friend_requests')
      .select('*')
      .eq('sender_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then((r) => {
        if (r.error) throw r.error
        return r.data || []
      }),
    supabase
      .from('streak_shares')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .then((r) => {
        if (r.error) throw r.error
        return r.data || []
      }),
    supabase
      .from('streak_shares')
      .select('*, users:sender_id(username, avatar, deleted_at)')
      .eq('receiver_id', userId)
      .eq('share_date', todayStr())
      .order('shared_at', { ascending: false })
      .then((r) => {
        if (r.error) throw r.error
        return r.data || []
      }),
  ])

  const today = todayStr()
  const friends = friendRows
    .filter((row) => !row.users?.deleted_at)
    .map((row) => ({
      id: row.user_id,
      username: row.users?.username,
      grade: row.users?.grade,
      avatar: row.users?.avatar,
      streak: getEffectiveStreak({ streak: row.current_streak, lastCorrectDate: row.last_answered_date }, today),
    }))

  const senderIds = [...new Set(receivedRequests.map((r) => r.sender_id))]
  const receiverIds = [...new Set(sentRequests.map((r) => r.receiver_id))]
  const [senderUsernames, receiverUsernames] = await Promise.all([usernameLookup(senderIds), usernameLookup(receiverIds)])

  return {
    friends,
    pendingRequests: {
      received: receivedRequests.map((r) => ({ id: r.id, senderId: r.sender_id, senderUsername: senderUsernames[r.sender_id] || 'Unknown' })),
      sent: sentRequests.map((r) => ({ id: r.id, receiverId: r.receiver_id, receiverUsername: receiverUsernames[r.receiver_id] || 'Unknown' })),
    },
    shares: shareRows,
    receivedToday: receivedTodayRows
      .filter((r) => !r.users?.deleted_at)
      .map((r) => ({
        id: r.id,
        senderUsername: r.users?.username || 'Unknown',
        senderAvatar: r.users?.avatar || null,
        senderStreak: r.sender_streak,
        sharedAt: r.shared_at,
      })),
  }
}

export default createStudentHandler({ method: 'GET', handle })
