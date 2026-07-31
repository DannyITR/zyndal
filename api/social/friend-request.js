import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUsername } from '../_lib/sanitize.js'
import { insertNotification } from '../_lib/notifications.js'
import { sendPushToUser } from '../_lib/push.js'

// Mirrors sendFriendRequest and respondToFriendRequest in storage.js behind
// one action-based endpoint, as spec'd. 'send' accepts target_user_id
// (search results already carry the target's id, so this avoids a redundant
// username round trip) or target_username, matching the literal spec —
// either works. 'accept'/'decline' need request_id, not a username: a
// username alone can't identify WHICH pending request to act on, and
// FriendsScreen already has request.id in hand from get-friends.js.
function validate(body) {
  if (!['send', 'accept', 'decline'].includes(body.action)) {
    return { field: 'action', message: "action must be 'send', 'accept', or 'decline'." }
  }

  if (body.action === 'send') {
    if (body.target_username !== undefined && body.target_username !== null && body.target_username !== '') {
      const targetUsername = sanitizeUsername(body.target_username)
      if (!targetUsername) {
        return { field: 'target_username', message: 'target_username must be 3-20 characters — letters, numbers, and underscores only.' }
      }
      body.target_username = targetUsername
    }
    if (!body.target_user_id && !body.target_username) {
      return { field: 'target_user_id', message: 'target_user_id or target_username is required to send a request.' }
    }
  }

  if ((body.action === 'accept' || body.action === 'decline') && !body.request_id) {
    return { field: 'request_id', message: 'request_id is required to accept or decline a request.' }
  }
  return null
}

async function findExistingFriendRequest(userAId, userBId) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .or(`and(sender_id.eq.${userAId},receiver_id.eq.${userBId}),and(sender_id.eq.${userBId},receiver_id.eq.${userAId})`)
    .in('status', ['pending', 'accepted'])
    .maybeSingle()
  if (error) throw error
  return data
}

async function handleSend(userId, body) {
  let targetId = body.target_user_id
  if (!targetId) {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('account_type', 'student')
      .is('deleted_at', null)
      .ilike('username', body.target_username)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      const err = new Error('No student found with that username.')
      err.status = 404
      err.code = 'NOT_FOUND'
      throw err
    }
    targetId = data.id
  } else {
    // target_user_id skips the username lookup above (and its deleted_at
    // filter) — search-users.js already excludes deleted accounts from
    // results, but a stale/cached id or a hand-crafted request could still
    // name one directly, so it's checked again here.
    const { data: target, error: targetError } = await supabase.from('users').select('deleted_at').eq('id', targetId).maybeSingle()
    if (targetError) throw targetError
    if (!target || target.deleted_at) {
      const err = new Error('That student is not available.')
      err.status = 404
      err.code = 'NOT_FOUND'
      throw err
    }
  }

  if (targetId === userId) {
    const err = new Error("You can't follow yourself.")
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }
  const existing = await findExistingFriendRequest(userId, targetId)
  if (existing) {
    const err = new Error(existing.status === 'accepted' ? 'You are already friends.' : 'A request is already pending.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }
  const { data: requestRow, error } = await supabase
    .from('friend_requests')
    .insert({ sender_id: userId, receiver_id: targetId, status: 'pending' })
    .select()
    .single()
  if (error) throw error

  const { data: sender } = await supabase.from('users').select('username').eq('id', userId).maybeSingle()
  const senderUsername = sender?.username || 'Someone'
  await insertNotification({
    userId: targetId,
    type: 'friend_request',
    title: `@${senderUsername} wants to follow you`,
    body: 'Tap to accept or decline',
    data: { request_id: requestRow.id, sender_id: userId, sender_username: senderUsername },
  })

  await sendPushToUser({
    userId: targetId,
    type: 'friend_request',
    title: `👋 @${senderUsername} wants to follow you on Zyndal`,
    body: 'Tap to accept or decline',
    url: 'https://zyndal.ca',
  })

  return { sent: true }
}

async function handleRespond(userId, body) {
  const accept = body.action === 'accept'
  const { data: request, error: fetchError } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('id', body.request_id)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!request) {
    const err = new Error('Friend request not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  // Only the receiver may accept/decline a request addressed to them.
  if (request.receiver_id !== userId) {
    const err = new Error('This request is not addressed to you.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  const { error: updateError } = await supabase
    .from('friend_requests')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', body.request_id)
  if (updateError) throw updateError

  if (accept) {
    const { error: friendError } = await supabase.from('friends').insert([
      { user_id: request.sender_id, friend_id: request.receiver_id },
      { user_id: request.receiver_id, friend_id: request.sender_id },
    ])
    if (friendError && friendError.code !== '23505') throw friendError

    // Notify the original requester that their request was accepted —
    // distinct type from 'friend_request' (not just different copy)
    // because NotificationsScreen.jsx renders Accept/Decline buttons for
    // that type, which makes no sense here; there's nothing left to act on.
    const { data: responder } = await supabase.from('users').select('username').eq('id', userId).maybeSingle()
    const responderUsername = responder?.username || 'Someone'
    await insertNotification({
      userId: request.sender_id,
      type: 'friend_accepted',
      title: `@${responderUsername} accepted your friend request`,
      body: 'You are now friends on Zyndal!',
      data: { responder_id: userId, responder_username: responderUsername },
    })

    // Reuses the 'friend_request' preference key — this app's Settings
    // page only exposes one friend-request-related toggle ("When someone
    // sends me a friend request"), and an "accepted" notification is the
    // same lifecycle, not a separate concern worth its own toggle/SQL
    // column addition.
    await sendPushToUser({
      userId: request.sender_id,
      type: 'friend_request',
      title: `🎉 @${responderUsername} accepted your friend request!`,
      body: "You're now friends on Zyndal — share your score to start a streak!",
      url: 'https://zyndal.ca',
    })
  }
  return { accepted: accept }
}

async function handle({ userId, body }) {
  if (body.action === 'send') return handleSend(userId, body)
  return handleRespond(userId, body)
}

export default createStudentHandler({ method: 'POST', validate, handle })
