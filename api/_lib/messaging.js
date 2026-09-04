import { waitUntil } from '@vercel/functions'
import { supabase } from './auth.js'
import { containsProfanity } from '../../src/lib/profanityFilter.js'
import { screenMessageSafety } from './messageSafety.js'
import { notificationText } from './notificationText.js'
import { insertNotification } from './notifications.js'
import { sendPushToUser } from './push.js'

// Canonical ordering so a conversation between two users only ever has one
// row regardless of who starts it — conversations.user_a_id/user_b_id has a
// check (user_a_id < user_b_id) constraint enforcing this at the DB level
// too; every endpoint that looks up or creates a conversation sorts the
// pair first so it always lands on the same row.
export function sortPairIds(idA, idB) {
  return idA < idB ? [idA, idB] : [idB, idA]
}

function forbidden(message) {
  const err = new Error(message)
  err.status = 403
  err.code = 'FORBIDDEN'
  return err
}

// friends rows are inserted symmetrically both ways on request acceptance
// (see api/social/friend-request.js), so a single direction check is
// sufficient — same pattern api/social/poke.js already uses for its own
// friends-only gate.
async function areFriends(userId, otherUserId) {
  const { data, error } = await supabase.from('friends').select('id').eq('user_id', userId).eq('friend_id', otherUserId).maybeSingle()
  if (error) throw error
  return Boolean(data)
}

// Same relationship api/_lib/parentDb.js's verifyStudentBelongsToParent
// already checks for the wallet/payout features — reused here, not
// reimplemented, for "can this parent message this child."
async function isParentOfStudent(parentId, studentId) {
  const { data, error } = await supabase.from('parent_student').select('id').eq('parent_id', parentId).eq('student_id', studentId).maybeSingle()
  if (error) throw error
  return Boolean(data)
}

// "Does this parent have a linked child enrolled in a class this teacher
// teaches" — same three tables (parent_student -> class_students ->
// classes.teacher_id) api/teacher/get-class-roster.js and
// api/teacher/get-classes.js already use for the equivalent lookup from
// the teacher's side.
async function isTeacherOfParentsChild(parentId, teacherId) {
  const { data: links, error: linksError } = await supabase.from('parent_student').select('student_id').eq('parent_id', parentId)
  if (linksError) throw linksError
  const studentIds = (links || []).map((l) => l.student_id)
  if (studentIds.length === 0) return false

  const { data: enrollments, error: enrollError } = await supabase.from('class_students').select('class_id').in('student_id', studentIds)
  if (enrollError) throw enrollError
  const classIds = [...new Set((enrollments || []).map((e) => e.class_id))]
  if (classIds.length === 0) return false

  const { data: taught, error: classesError } = await supabase.from('classes').select('id').eq('teacher_id', teacherId).in('id', classIds)
  if (classesError) throw classesError
  return Boolean(taught && taught.length > 0)
}

// The full permission matrix, checked once at conversation-creation time
// (not re-checked on every send — an existing conversation keeps working
// even if the underlying relationship changes later, e.g. a parent
// unlinks a child). Allowed pairings:
//   admin + anyone            -> always allowed
//   student + student         -> friends only (existing behavior)
//   parent + own child        -> parent_student link
//   parent + child's teacher  -> parent has a linked student enrolled in
//                                a class this teacher teaches
// Everything else — teacher + student in either direction, teacher +
// teacher, parent + parent, student + non-friend, parent + unrelated
// student/teacher — falls through to the generic rejection at the bottom.
// teacher + student needs no special-case code to be "never allowed under
// any circumstance": it simply never matches an allowed branch above.
export async function verifyConversationAllowed(userAId, userBId) {
  const { data: users, error } = await supabase.from('users').select('id, account_type').in('id', [userAId, userBId])
  if (error) throw error
  const userA = (users || []).find((u) => u.id === userAId)
  const userB = (users || []).find((u) => u.id === userBId)
  if (!userA || !userB) {
    const err = new Error('User not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  if (userA.account_type === 'admin' || userB.account_type === 'admin') return

  const types = [userA.account_type, userB.account_type].sort()
  const key = types.join('_')

  if (key === 'student_student') {
    if (!(await areFriends(userAId, userBId))) throw forbidden('You can only message friends.')
    return
  }

  if (key === 'parent_student') {
    const parent = userA.account_type === 'parent' ? userA : userB
    const student = userA.account_type === 'student' ? userA : userB
    if (!(await isParentOfStudent(parent.id, student.id))) throw forbidden('Parents can only message their own linked child.')
    return
  }

  if (key === 'parent_teacher') {
    const parent = userA.account_type === 'parent' ? userA : userB
    const teacher = userA.account_type === 'teacher' ? userA : userB
    if (!(await isTeacherOfParentsChild(parent.id, teacher.id))) {
      throw forbidden("You can only message your child's own teachers.")
    }
    return
  }

  throw forbidden('This account pairing cannot message each other.')
}

// Shared by api/messages/get-or-create-conversation.js and
// api/admin/start-conversation.js — idA/idB need not be pre-sorted, this
// does it. Select-then-insert with a 23505 re-read on conflict (same
// pattern api/curriculum/get-outline.js already uses) rather than relying
// solely on the unique constraint, so two near-simultaneous first
// messages between the same pair still agree on one conversation row.
export async function findOrCreateConversation(idA, idB) {
  const [userAId, userBId] = sortPairIds(idA, idB)

  const { data: existing, error: existingError } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_a_id', userAId)
    .eq('user_b_id', userBId)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return existing

  const { data: inserted, error: insertError } = await supabase
    .from('conversations')
    .insert({ user_a_id: userAId, user_b_id: userBId })
    .select()
    .single()
  if (!insertError) return inserted

  if (insertError.code === '23505') {
    const { data: winner, error: refetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_a_id', userAId)
      .eq('user_b_id', userBId)
      .maybeSingle()
    if (refetchError) throw refetchError
    if (winner) return winner
  }
  throw insertError
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

// Called from listMessagesInConversation on every fetch — the initial open
// and every ~4s poll tick while MessagesFlow.jsx's thread view stays open
// (see useVisibilityAwarePolling there, which already pauses polling once
// the app is backgrounded) — so this is a live "still looking at this
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

// Called from sendMessageInConversation for the RECIPIENT (not the
// sender) right before deciding whether to push — true only if their own
// last_viewed_at on this exact conversation was refreshed within the
// window above.
export function isActivelyViewing(conversation, userId) {
  const lastViewedAt = conversation[viewedColumnFor(conversation, userId)]
  if (!lastViewedAt) return false
  return Date.now() - new Date(lastViewedAt).getTime() < ACTIVE_VIEW_WINDOW_MS
}

// ---------- Shared read/write core ----------
// The actual DB logic behind list/read/send lives here so both the
// regular session-based endpoints (api/messages/*.js — student, parent,
// teacher, all via the same X-Session-Token auth) and the admin-token-
// based endpoints (api/admin/*.js — a completely separate auth mechanism,
// see adminHandler.js) call the exact same code instead of duplicating it.

// Used by both api/messages/get-conversations.js and
// api/admin/get-inbox-conversations.js.
export async function listConversationsForUser(userId) {
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('id, user_a_id, user_b_id')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
  if (error) throw error
  if ((conversations || []).length === 0) return { conversations: [] }

  const otherIdByConversation = {}
  for (const c of conversations) otherIdByConversation[c.id] = c.user_a_id === userId ? c.user_b_id : c.user_a_id
  const otherIds = [...new Set(Object.values(otherIdByConversation))]

  const { data: otherUsers, error: usersError } = await supabase.from('users').select('id, username, avatar, account_type').in('id', otherIds)
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
    const otherUser = userById[otherIdByConversation[c.id]]
    return {
      id: c.id,
      otherUser: otherUser
        ? { id: otherUser.id, username: otherUser.username, avatar: otherUser.avatar, isAdmin: otherUser.account_type === 'admin' }
        : { id: otherIdByConversation[c.id], username: 'Unknown', avatar: null, isAdmin: false },
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

// Used by both api/messages/get-messages.js and
// api/admin/get-inbox-messages.js — not to be confused with the unrelated
// api/admin/get-messages.js, a read-only platform-wide message browse.
// conversation must already be resolved (and ownership-checked, for a
// non-admin caller) by the caller via getConversationOrThrow.
export async function listMessagesInConversation(conversation, userId) {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at, read_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
  if (error) throw error

  // Opening the thread is what marks the other participant's messages read
  // — no separate "mark read" call needed, and this is what clears the
  // conversation's unread badge on the next get-conversations fetch.
  const { error: readError } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversation.id)
    .neq('sender_id', userId)
    .is('read_at', null)
  if (readError) throw readError

  // Refreshes this caller's own "currently viewing" heartbeat — see this
  // file's own comment above. Best-effort: a failure here shouldn't turn
  // "load my messages" into an error just because a push notification
  // later might not get suppressed.
  markConversationViewed(conversation, userId).catch((err) => console.error('[messages] failed to record conversation view:', err))

  const senderIds = [...new Set((messages || []).map((m) => m.sender_id))]
  const { data: senders, error: sendersError } = senderIds.length
    ? await supabase.from('users').select('id, account_type').in('id', senderIds)
    : { data: [] }
  if (sendersError) throw sendersError
  const isAdminBySender = Object.fromEntries((senders || []).map((u) => [u.id, u.account_type === 'admin']))

  return {
    messages: (messages || []).map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at,
      isMine: m.sender_id === userId,
      isAdmin: Boolean(isAdminBySender[m.sender_id]),
    })),
  }
}

// Used by both api/messages/send-message.js (skipSafetyScreening: false)
// and api/admin/send-inbox-message.js (skipSafetyScreening: true — admin
// messages are exempt from the AI safety screen, per spec, though never
// from the profanity filter below). conversation must already be resolved
// by the caller via getConversationOrThrow.
export async function sendMessageInConversation({ conversation, senderId, body, skipSafetyScreening }) {
  // Same block-and-warn behavior as api/forum/create-thread.js — the
  // client runs the same containsProfanity() check before ever
  // submitting, but this is the authoritative check, and it applies
  // uniformly regardless of who's sending, admin included.
  if (containsProfanity(body)) {
    const err = new Error('Your message may contain inappropriate language. Please revise it and try again.')
    err.status = 400
    err.code = 'PROFANITY_DETECTED'
    throw err
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversation.id, sender_id: senderId, body })
    .select()
    .single()
  if (error) throw error

  if (!skipSafetyScreening) {
    // Fire-and-forget via waitUntil (same pattern as
    // api/_lib/dailyQuestion.js's background pool generation) — the
    // message is already inserted and about to be delivered/notified
    // below, so this AI screening pass runs after the response is sent
    // and never adds latency to sending a message.
    waitUntil(screenMessageSafety(message.id, body).catch((err) => console.error('[messages] safety screening failed:', err)))
  }

  const recipientId = conversation.user_a_id === senderId ? conversation.user_b_id : conversation.user_a_id

  // Best-effort — a failed notification never fails the message itself.
  try {
    const [{ data: sender }, { data: recipient }] = await Promise.all([
      supabase.from('users').select('username').eq('id', senderId).maybeSingle(),
      supabase.from('users').select('language_preference').eq('id', recipientId).maybeSingle(),
    ])
    const senderUsername = sender?.username || 'Someone'
    const bodyPreview = body.length > 80 ? `${body.slice(0, 80)}…` : body
    const params = { senderUsername, bodyPreview }

    const { title, body: notifBody } = notificationText('message_received', recipient?.language_preference, params)
    await insertNotification({
      userId: recipientId,
      type: 'message_received',
      title,
      body: notifBody,
      data: { conversation_id: conversation.id, message_id: message.id },
    })

    // Skip only the push (the in-app notification row above is still
    // logged either way, as a durable record) when the recipient's own
    // last_viewed_at on this exact conversation was refreshed within the
    // last few seconds — see isActivelyViewing above.
    if (!isActivelyViewing(conversation, recipientId)) {
      await sendPushToUser({ userId: recipientId, type: 'message_received', title, body: notifBody, url: 'https://zyndal.ca' })
    }
  } catch (err) {
    console.error('[messages] failed to notify recipient of new message:', err)
  }

  return { message }
}
