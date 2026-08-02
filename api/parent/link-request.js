import { createParentHandler } from '../_lib/parentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { insertNotification } from '../_lib/notifications.js'
import { sendPushToUser } from '../_lib/push.js'

function validate(body) {
  const studentId = sanitizeUuid(body.student_id)
  if (!studentId) return { field: 'student_id', message: 'A valid student_id is required.' }
  body.student_id = studentId
  return null
}

// "Add Child" Option A (search by username) — sends the student an
// accept/decline notification instead of linking immediately, unlike
// link-parent.js (Option C / code entry), which links on the spot since
// the student is the one initiating that action.
async function handle({ parentId, body }) {
  const { data: student, error: studentError } = await supabase
    .from('users')
    .select('id, username, account_type, deleted_at')
    .eq('id', body.student_id)
    .maybeSingle()
  if (studentError) throw studentError
  if (!student || student.account_type !== 'student' || student.deleted_at) {
    const err = new Error('That student is not available.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const { data: existingLink, error: existingLinkError } = await supabase
    .from('parent_student')
    .select('parent_id')
    .eq('student_id', body.student_id)
    .maybeSingle()
  if (existingLinkError) throw existingLinkError
  if (existingLink) {
    const err = new Error('That student is already linked to a parent.')
    err.status = 400
    err.code = 'ALREADY_LINKED'
    throw err
  }

  const { data: existingInvite, error: existingInviteError } = await supabase
    .from('parent_invitations')
    .select('id')
    .eq('parent_id', parentId)
    .eq('student_id', body.student_id)
    .eq('status', 'pending')
    .maybeSingle()
  if (existingInviteError) throw existingInviteError
  if (existingInvite) {
    const err = new Error('You already have a pending request to this student.')
    err.status = 400
    err.code = 'ALREADY_PENDING'
    throw err
  }

  const { data: parent, error: parentError } = await supabase.from('users').select('username, parent_code').eq('id', parentId).maybeSingle()
  if (parentError) throw parentError

  const { data: invitation, error: insertError } = await supabase
    .from('parent_invitations')
    .insert({
      parent_id: parentId,
      student_id: body.student_id,
      parent_code: parent.parent_code,
      invite_type: 'username_search',
      status: 'pending',
    })
    .select()
    .single()
  if (insertError) throw insertError

  const title = `@${parent.username} wants to link as your parent`
  const notifBody = 'Accept or decline this request.'
  await insertNotification({
    userId: body.student_id,
    type: 'parent_link_request',
    title,
    body: notifBody,
    data: { invitation_id: invitation.id, parent_id: parentId, parent_username: parent.username },
  })
  await sendPushToUser({
    userId: body.student_id,
    type: 'parent_link_request',
    title: `👨‍👩‍👧 ${title}`,
    body: notifBody,
    url: 'https://zyndal.ca',
  })

  return { invitation }
}

export default createParentHandler({ method: 'POST', validate, handle })
