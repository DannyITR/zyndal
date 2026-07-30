import { supabase } from './auth.js'

// Best-effort/non-throwing (matches syncUserTimezone's convention in
// db.js) — a failed notification insert must never fail the underlying
// share/friend-request action itself.
export async function insertNotification({ userId, type, title, body, data }) {
  const { error } = await supabase.from('notifications').insert({ user_id: userId, type, title, body, data: data ?? null })
  if (error) console.error('[notifications] failed to insert:', error)
}
