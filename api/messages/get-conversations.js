import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { assertIsStudent } from '../_lib/messaging.js'

async function handle({ userId }) {
  await assertIsStudent(userId)

  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('id, user_a_id, user_b_id')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
  if (error) throw error
  if ((conversations || []).length === 0) return { conversations: [] }

  const otherIdByConversation = {}
  for (const c of conversations) otherIdByConversation[c.id] = c.user_a_id === userId ? c.user_b_id : c.user_a_id
  const otherIds = [...new Set(Object.values(otherIdByConversation))]

  const { data: otherUsers, error: usersError } = await supabase.from('users').select('id, username, avatar').in('id', otherIds)
  if (usersError) throw usersError
  const userById = Object.fromEntries((otherUsers || []).map((u) => [u.id, u]))

  const conversationIds = conversations.map((c) => c.id)
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('conversation_id, sender_id, body, created_at, read_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true })
  if (messagesError) throw messagesError

  const lastMessageByConversation = {}
  const unreadCountByConversation = {}
  for (const m of messages || []) {
    // Ascending order means the last write per conversation_id wins here.
    lastMessageByConversation[m.conversation_id] = m
    if (m.sender_id !== userId && !m.read_at) {
      unreadCountByConversation[m.conversation_id] = (unreadCountByConversation[m.conversation_id] || 0) + 1
    }
  }

  const enriched = conversations.map((c) => {
    const last = lastMessageByConversation[c.id]
    return {
      id: c.id,
      otherUser: userById[otherIdByConversation[c.id]] || { id: otherIdByConversation[c.id], username: 'Unknown', avatar: null },
      lastMessagePreview: last?.body || null,
      lastMessageSenderId: last?.sender_id || null,
      lastMessageAt: last?.created_at || null,
      unreadCount: unreadCountByConversation[c.id] || 0,
    }
  })
  enriched.sort((a, b) => {
    if (!a.lastMessageAt && !b.lastMessageAt) return 0
    if (!a.lastMessageAt) return 1
    if (!b.lastMessageAt) return -1
    return a.lastMessageAt < b.lastMessageAt ? 1 : -1
  })

  return { conversations: enriched }
}

export default createStudentHandler({ method: 'GET', handle })
