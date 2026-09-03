import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeString, sanitizeUuid } from '../_lib/sanitize.js'

const MAX_LIMIT = 200

// Full browse/search access to every private message on the platform —
// unlike the forum (report-only visibility), the spec calls for admin to
// see all DMs, not just reported ones. Mirrors get-users.js's own
// pagination/search shape.
async function handle({ body }) {
  const page = Math.max(1, parseInt(body.page, 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(body.limit, 10) || 50))
  const from = (page - 1) * limit
  const to = from + limit - 1

  const conversationId = sanitizeUuid(body.conversation_id)
  const search = sanitizeString(body.search, 100)

  let conversationIdsFromSearch = null
  if (search) {
    const { data: matchingUsers, error: userSearchError } = await supabase.from('users').select('id').ilike('username', `%${search}%`)
    if (userSearchError) throw userSearchError
    const matchingIds = (matchingUsers || []).map((u) => u.id)
    if (matchingIds.length === 0) return { messages: [], page, limit, total: 0, totalPages: 1 }

    const { data: matchingConversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .or(matchingIds.map((id) => `user_a_id.eq.${id},user_b_id.eq.${id}`).join(','))
    if (convError) throw convError
    conversationIdsFromSearch = (matchingConversations || []).map((c) => c.id)
    if (conversationIdsFromSearch.length === 0) return { messages: [], page, limit, total: 0, totalPages: 1 }
  }

  let query = supabase.from('messages').select('id, conversation_id, sender_id, body, created_at, read_at', { count: 'exact' })
  if (conversationId) query = query.eq('conversation_id', conversationId)
  if (conversationIdsFromSearch) query = query.in('conversation_id', conversationIdsFromSearch)
  query = query.order('created_at', { ascending: false }).range(from, to)

  const { data: messages, count, error } = await query
  if (error) throw error

  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / limit))
  if (!messages || messages.length === 0) return { messages: [], page, limit, total, totalPages }

  const conversationIds = [...new Set(messages.map((m) => m.conversation_id))]
  const { data: conversations, error: conversationsError } = await supabase
    .from('conversations')
    .select('id, user_a_id, user_b_id')
    .in('id', conversationIds)
  if (conversationsError) throw conversationsError
  const conversationById = Object.fromEntries((conversations || []).map((c) => [c.id, c]))

  const participantIds = [...new Set((conversations || []).flatMap((c) => [c.user_a_id, c.user_b_id]))]
  const { data: users, error: usersError } = await supabase.from('users').select('id, username').in('id', participantIds)
  if (usersError) throw usersError
  const usernameById = Object.fromEntries((users || []).map((u) => [u.id, u.username]))

  return {
    messages: messages.map((m) => {
      const conversation = conversationById[m.conversation_id]
      return {
        id: m.id,
        conversationId: m.conversation_id,
        senderUsername: usernameById[m.sender_id] || 'Unknown',
        recipientUsername: conversation
          ? usernameById[conversation.user_a_id === m.sender_id ? conversation.user_b_id : conversation.user_a_id] || 'Unknown'
          : 'Unknown',
        body: m.body,
        createdAt: m.created_at,
        readAt: m.read_at,
      }
    }),
    page,
    limit,
    total,
    totalPages,
  }
}

export default createAdminHandler({ method: 'GET', handle })
