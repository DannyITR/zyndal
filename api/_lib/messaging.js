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

// Which of conversations' two "last viewed" columns belongs to userId —
// shared by markConversationViewed (called by the viewer) and
// isActivelyViewing (called for the OTHER participant, to decide whether
// to skip a push).
function viewedColumnFor(conversation, userId) {
  return conversation.user_a_id === userId ? 'user_a_last_viewed_at' : 'user_b_last_viewed_at'
}

// Called from api/messages/get-messages.js on every fetch — the initial
// open and every ~4s poll tick while MessagesFlow.jsx's thread view stays
// open (see useVisibilityAwarePolling there, which already pauses polling
// once the app is backgrounded) — so this is a live "still looking at this
// thread" heartbeat, not a one-time read receipt.
export async function markConversationViewed(conversation, userId) {
  const column = viewedColumnFor(conversation, userId)
  const { error } = await supabase
    .from('conversations')
    .update({ [column]: new Date().toISOString() })
    .eq('id', conversation.id)
  if (error) throw error
}

// A few seconds wider than MessagesFlow.jsx's own 4s poll interval so a
// single delayed tick (a slow request, a just-resumed background tab)
// doesn't wrongly read as "they left" — but still short enough that
// actually leaving the thread (or the app going to the background, which
// pauses the poll that keeps this fresh) resumes normal push behavior
// within a few seconds.
const ACTIVE_VIEW_WINDOW_MS = 10000

// Called from api/messages/send-message.js for the RECIPIENT (not the
// sender) right before deciding whether to push — true only if their own
// last_viewed_at on this exact conversation was refreshed within the
// window above.
export function isActivelyViewing(conversation, userId) {
  const lastViewedAt = conversation[viewedColumnFor(conversation, userId)]
  if (!lastViewedAt) return false
  return Date.now() - new Date(lastViewedAt).getTime() < ACTIVE_VIEW_WINDOW_MS
}
