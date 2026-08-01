import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

async function handle({ userId }) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const notifications = data || []

  // A friend_request notification's title/body are fixed at send time and
  // never change, but the underlying friend_requests row can move to
  // accepted/declined afterward (via this same screen, or the Friends
  // screen's own banner) without this notification being touched — so
  // NotificationsScreen needs the row's CURRENT status, not just what was
  // true when the notification was created, to know whether Accept/Decline
  // still applies.
  const requestIds = [...new Set(notifications.filter((n) => n.type === 'friend_request' && n.data?.request_id).map((n) => n.data.request_id))]
  let statusByRequestId = {}
  if (requestIds.length > 0) {
    const { data: requestRows, error: requestError } = await supabase.from('friend_requests').select('id, status').in('id', requestIds)
    if (requestError) throw requestError
    statusByRequestId = Object.fromEntries((requestRows || []).map((r) => [r.id, r.status]))
  }

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data,
      readAt: n.read_at,
      createdAt: n.created_at,
      requestStatus: n.type === 'friend_request' ? statusByRequestId[n.data?.request_id] || null : null,
    })),
    unreadCount: notifications.filter((n) => !n.read_at).length,
  }
}

export default createStudentHandler({ method: 'GET', handle })
