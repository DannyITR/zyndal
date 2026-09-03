import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'

async function handle() {
  const { data: reports, error } = await supabase
    .from('message_reports')
    .select('id, target_id, reporter_id, reason, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  if ((reports || []).length === 0) return { reports: [] }

  const messageIds = reports.map((r) => r.target_id)
  const { data: messages, error: messagesError } = await supabase.from('messages').select('id, sender_id, body').in('id', messageIds)
  if (messagesError) throw messagesError
  const messageById = Object.fromEntries((messages || []).map((m) => [m.id, m]))

  const reporterIds = [...new Set(reports.map((r) => r.reporter_id))]
  const senderIds = [...new Set((messages || []).map((m) => m.sender_id))]
  const { data: users, error: usersError } = await supabase.from('users').select('id, username').in('id', [...new Set([...reporterIds, ...senderIds])])
  if (usersError) throw usersError
  const usernameById = Object.fromEntries((users || []).map((u) => [u.id, u.username]))

  return {
    reports: reports.map((r) => {
      const message = messageById[r.target_id]
      return {
        id: r.id,
        targetId: r.target_id,
        reporterUsername: usernameById[r.reporter_id] || 'Unknown',
        senderUsername: message ? usernameById[message.sender_id] || 'Unknown' : 'Unknown',
        contentPreview: message ? message.body : '[message deleted]',
        reason: r.reason,
        submittedAt: r.created_at,
        contentExists: Boolean(message),
      }
    }),
  }
}

export default createAdminHandler({ method: 'GET', handle })
