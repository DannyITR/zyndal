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
  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data,
      readAt: n.read_at,
      createdAt: n.created_at,
    })),
    unreadCount: notifications.filter((n) => !n.read_at).length,
  }
}

export default createStudentHandler({ method: 'GET', handle })
