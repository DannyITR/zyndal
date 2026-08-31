import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeString } from '../_lib/sanitize.js'
import { notificationText } from '../_lib/notificationText.js'
import { insertNotification } from '../_lib/notifications.js'
import { sendPushToUser } from '../_lib/push.js'
import { sendSchoolChangeApprovedEmail, sendSchoolChangeRejectedEmail } from '../_lib/resend.js'

function validate(body) {
  const requestId = sanitizeUuid(body.request_id)
  if (!requestId) return { field: 'request_id', message: 'request_id must be a valid request id.' }
  body.request_id = requestId

  if (body.action !== 'approve' && body.action !== 'reject') {
    return { field: 'action', message: "action must be 'approve' or 'reject'." }
  }

  if (body.rejection_reason !== undefined && body.rejection_reason !== null && body.rejection_reason !== '') {
    body.rejection_reason = sanitizeString(body.rejection_reason, 500)
  }

  return null
}

async function handle({ body }) {
  const { request_id: requestId, action, rejection_reason: rejectionReason } = body

  const { data: request, error: requestError } = await supabase.from('school_change_requests').select('*').eq('id', requestId).maybeSingle()
  if (requestError) throw requestError
  if (!request) {
    const err = new Error('Request not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (request.status !== 'pending') {
    const err = new Error('This request has already been resolved.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  const { data: student, error: studentError } = await supabase
    .from('users')
    .select('email, language_preference')
    .eq('id', request.student_id)
    .maybeSingle()
  if (studentError) throw studentError

  if (action === 'reject') {
    const { error: updateError } = await supabase
      .from('school_change_requests')
      .update({ status: 'rejected', resolved_at: new Date().toISOString(), rejection_reason: rejectionReason || null })
      .eq('id', requestId)
    if (updateError) throw updateError

    const { title, body: notifBody } = notificationText('school_change_rejected', student?.language_preference, {
      reason: rejectionReason || null,
    })
    await insertNotification({ userId: request.student_id, type: 'school_change_rejected', title, body: notifBody, data: { request_id: requestId } })
    await sendPushToUser({ userId: request.student_id, type: 'school_change_rejected', title, body: notifBody, url: 'https://zyndal.ca' })
    if (student?.email) {
      await sendSchoolChangeRejectedEmail({ email: student.email, languagePreference: student.language_preference, reason: rejectionReason || null }).catch(
        (err) => console.error('[resolve-school-change-request] failed to send rejection email:', err)
      )
    }

    return { request: { ...request, status: 'rejected' } }
  }

  let schoolName
  const updates = {}
  if (request.requested_school_id) {
    const { data: school, error: schoolError } = await supabase.from('schools').select('name').eq('id', request.requested_school_id).maybeSingle()
    if (schoolError) throw schoolError
    schoolName = school?.name || 'your new school'
    updates.school_id = request.requested_school_id
  } else {
    // "Other/not listed" — same as the original signup behavior: free-text
    // school, no structured school_id.
    schoolName = request.requested_school_name || 'your new school'
    updates.school_id = null
    updates.school = request.requested_school_name
  }

  const { error: userUpdateError } = await supabase.from('users').update(updates).eq('id', request.student_id)
  if (userUpdateError) throw userUpdateError

  const { error: updateError } = await supabase
    .from('school_change_requests')
    .update({ status: 'approved', resolved_at: new Date().toISOString() })
    .eq('id', requestId)
  if (updateError) throw updateError

  const { title, body: notifBody } = notificationText('school_change_approved', student?.language_preference, { schoolName })
  await insertNotification({ userId: request.student_id, type: 'school_change_approved', title, body: notifBody, data: { request_id: requestId } })
  await sendPushToUser({ userId: request.student_id, type: 'school_change_approved', title, body: notifBody, url: 'https://zyndal.ca' })
  if (student?.email) {
    await sendSchoolChangeApprovedEmail({ email: student.email, languagePreference: student.language_preference }).catch((err) =>
      console.error('[resolve-school-change-request] failed to send approval email:', err)
    )
  }

  return { request: { ...request, status: 'approved' } }
}

export default createAdminHandler({ method: 'POST', validate, handle })
