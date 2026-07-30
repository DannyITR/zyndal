import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

function validate(body) {
  if (!body.mark_all && !body.notification_id) {
    return 'notification_id is required (or set mark_all: true).'
  }
  return null
}

async function handle({ userId, body }) {
  if (body.mark_all) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
    if (error) throw error
    return { marked: true }
  }

  // Fetch-then-403, matching every other "act on my own row" endpoint in
  // this app (friend-request.js's handleRespond, update-study-plan.js,
  // resolve-bonus.js) — a bare update().eq('user_id', userId) would just
  // silently no-op on a mismatched id instead of telling the caller why.
  const { data: notification, error: fetchError } = await supabase
    .from('notifications')
    .select('id, user_id')
    .eq('id', body.notification_id)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!notification) {
    const err = new Error('Notification not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (notification.user_id !== userId) {
    const err = new Error('This notification is not addressed to you.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', body.notification_id)
  if (error) throw error
  return { marked: true }
}

export default createStudentHandler({ method: 'POST', validate, handle })
