import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

// Mirrors sendFriendRequest and respondToFriendRequest in storage.js behind
// one action-based endpoint, as spec'd. 'send' accepts target_user_id
// (search results already carry the target's id, so this avoids a redundant
// username round trip) or target_username, matching the literal spec —
// either works. 'accept'/'decline' need request_id, not a username: a
// username alone can't identify WHICH pending request to act on, and
// FriendsScreen already has request.id in hand from get-friends.js.
function validate(body) {
  if (!['send', 'accept', 'decline'].includes(body.action)) return "action must be 'send', 'accept', or 'decline'."
  if (body.action === 'send' && !body.target_user_id && !body.target_username) {
    return 'target_user_id or target_username is required to send a request.'
  }
  if ((body.action === 'accept' || body.action === 'decline') && !body.request_id) {
    return 'request_id is required to accept or decline a request.'
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
      .ilike('username', body.target_username.trim())
      .maybeSingle()
    if (error) throw error
    if (!data) {
      const err = new Error('No student found with that username.')
      err.status = 404
      err.code = 'NOT_FOUND'
      throw err
    }
    targetId = data.id
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
  const { error } = await supabase.from('friend_requests').insert({ sender_id: userId, receiver_id: targetId, status: 'pending' })
  if (error) throw error
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
  }
  return { accepted: accept }
}

async function handle({ userId, body }) {
  if (body.action === 'send') return handleSend(userId, body)
  return handleRespond(userId, body)
}

export default createStudentHandler({ method: 'POST', validate, handle })
