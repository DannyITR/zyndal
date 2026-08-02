import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { insertNotification } from '../_lib/notifications.js'
import { sendPushToUser } from '../_lib/push.js'

function validate(body) {
  const invitationId = sanitizeUuid(body.invitation_id)
  if (!invitationId) return { field: 'invitation_id', message: 'A valid invitation_id is required.' }
  body.invitation_id = invitationId

  if (body.action !== 'accept' && body.action !== 'decline') {
    return { field: 'action', message: "action must be 'accept' or 'decline'." }
  }
  return null
}

// Resolves a parent's "Add Child → Search by username" request (see
// api/parent/link-request.js). Only ever handles invitations already
// addressed to a specific student_id — an 'email' invite the student
// hasn't claimed yet has no student_id to check ownership against, and is
// instead resolved through link-parent.js's code-entry path (Settings, or
// the invite email's own link) once the student actually acts on it.
async function handle({ userId, body }) {
  const { data: invitation, error: fetchError } = await supabase
    .from('parent_invitations')
    .select('*')
    .eq('id', body.invitation_id)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!invitation) {
    const err = new Error('Request not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (invitation.student_id !== userId) {
    const err = new Error('This request is not addressed to you.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }
  if (invitation.status !== 'pending') {
    const err = new Error('This request has already been resolved.')
    err.status = 400
    err.code = 'ALREADY_RESOLVED'
    throw err
  }

  if (body.action === 'decline') {
    const { error: updateError } = await supabase.from('parent_invitations').update({ status: 'declined' }).eq('id', invitation.id)
    if (updateError) throw updateError
    return { accepted: false }
  }

  const { data: existingLink, error: existingLinkError } = await supabase
    .from('parent_student')
    .select('parent_id')
    .eq('student_id', userId)
    .maybeSingle()
  if (existingLinkError) throw existingLinkError
  if (existingLink && existingLink.parent_id !== invitation.parent_id) {
    const err = new Error("You're already linked to a parent.")
    err.status = 400
    err.code = 'ALREADY_LINKED'
    throw err
  }

  if (!existingLink) {
    const { error: insertError } = await supabase
      .from('parent_student')
      .insert({ parent_id: invitation.parent_id, student_id: userId })
    if (insertError) throw insertError
  }

  const { error: updateError } = await supabase
    .from('parent_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)
  if (updateError) throw updateError

  const { data: student } = await supabase.from('users').select('username').eq('id', userId).maybeSingle()
  const title = `✅ @${student?.username || 'A student'} is now linked to your account`
  await insertNotification({
    userId: invitation.parent_id,
    type: 'parent_link_accepted',
    title,
    body: 'You can now see their progress on your dashboard.',
    data: { student_id: userId, student_username: student?.username },
  })
  await sendPushToUser({
    userId: invitation.parent_id,
    type: 'parent_link_accepted',
    title,
    body: 'You can now see their progress on your dashboard.',
    url: 'https://zyndal.ca',
  })

  return { accepted: true }
}

export default createStudentHandler({ method: 'POST', validate, handle })
