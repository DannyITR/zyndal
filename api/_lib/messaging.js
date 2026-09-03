import { supabase } from './auth.js'

// Canonical ordering so a conversation between two users only ever has one
// row regardless of who starts it — conversations.user_a_id/user_b_id has a
// check (user_a_id < user_b_id) constraint enforcing this at the DB level
// too; every endpoint that looks up or creates a conversation sorts the
// pair first so it always lands on the same row.
export function sortPairIds(idA, idB) {
  return idA < idB ? [idA, idB] : [idB, idA]
}

// Defense-in-depth: the friend system this feature is gated on is already
// student-only in practice (no teacher account ever has a friends row), but
// the spec is explicit that a teacher must never reach this feature "under
// any circumstance" — so every messaging endpoint checks account_type
// itself rather than relying only on that incidental scoping.
export async function assertIsStudent(userId) {
  const { data: user, error } = await supabase.from('users').select('account_type').eq('id', userId).maybeSingle()
  if (error) throw error
  if (user?.account_type !== 'student') {
    const err = new Error('This feature is only available to student accounts.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }
}

// friends rows are inserted symmetrically both ways on request acceptance
// (see api/social/friend-request.js), so a single direction check is
// sufficient — same pattern api/social/poke.js already uses for its own
// friends-only gate.
export async function verifyFriendship(userId, otherUserId) {
  const { data, error } = await supabase.from('friends').select('id').eq('user_id', userId).eq('friend_id', otherUserId).maybeSingle()
  if (error) throw error
  if (!data) {
    const err = new Error('You can only message friends.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }
}

// Shared by every endpoint that takes a conversation_id — loads it and
// confirms userId is actually one of its two participants before letting
// the caller read/write anything scoped to it.
export async function getConversationOrThrow(conversationId, userId) {
  const { data: conversation, error } = await supabase.from('conversations').select('*').eq('id', conversationId).maybeSingle()
  if (error) throw error
  if (!conversation) {
    const err = new Error('That conversation was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (conversation.user_a_id !== userId && conversation.user_b_id !== userId) {
    const err = new Error('You are not part of this conversation.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }
  return conversation
}
