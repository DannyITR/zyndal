import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { generateUniqueTeacherCode } from '../_lib/db.js'
import { sanitizeUuid, sanitizeString } from '../_lib/sanitize.js'
import { notificationText } from '../_lib/notificationText.js'
import { insertNotification } from '../_lib/notifications.js'
import { sendPushToUser } from '../_lib/push.js'
import { sendClassClaimApprovedEmail, sendClassClaimRejectedEmail } from '../_lib/resend.js'

function validate(body) {
  const claimId = sanitizeUuid(body.claim_id)
  if (!claimId) return { field: 'claim_id', message: 'claim_id must be a valid claim id.' }
  body.claim_id = claimId

  if (body.action !== 'approve' && body.action !== 'reject') {
    return { field: 'action', message: "action must be 'approve' or 'reject'." }
  }

  if (body.rejection_reason !== undefined && body.rejection_reason !== null && body.rejection_reason !== '') {
    body.rejection_reason = sanitizeString(body.rejection_reason, 500)
  }

  return null
}

async function handle({ body }) {
  const { claim_id: claimId, action, rejection_reason: rejectionReason } = body

  const { data: claim, error: claimError } = await supabase.from('teacher_claims').select('*').eq('id', claimId).maybeSingle()
  if (claimError) throw claimError
  if (!claim) {
    const err = new Error('Claim not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (claim.status !== 'pending') {
    const err = new Error('This claim has already been resolved.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  const { data: teacher, error: teacherError } = await supabase
    .from('users')
    .select('email, language_preference')
    .eq('id', claim.teacher_id)
    .maybeSingle()
  if (teacherError) throw teacherError

  if (action === 'reject') {
    const { error: updateError } = await supabase
      .from('teacher_claims')
      .update({ status: 'rejected', resolved_at: new Date().toISOString(), rejection_reason: rejectionReason || null })
      .eq('id', claimId)
    if (updateError) throw updateError

    const { title, body: notifBody } = notificationText('class_claim_rejected', teacher?.language_preference, {
      courseNumber: claim.course_number,
      reason: rejectionReason || null,
    })
    await insertNotification({ userId: claim.teacher_id, type: 'class_claim_rejected', title, body: notifBody, data: { claim_id: claimId } })
    await sendPushToUser({ userId: claim.teacher_id, type: 'class_claim_rejected', title, body: notifBody, url: 'https://zyndal.ca' })
    if (teacher?.email) {
      await sendClassClaimRejectedEmail({ email: teacher.email, languagePreference: teacher.language_preference, reason: rejectionReason || null }).catch(
        (err) => console.error('[resolve-teacher-claim] failed to send rejection email:', err)
      )
    }

    return { claim: { ...claim, status: 'rejected' } }
  }

  const { data: group, error: groupError } = await supabase
    .from('school_subject_groups')
    .select('id, school_id, subject, grade')
    .eq('id', claim.group_id)
    .maybeSingle()
  if (groupError) throw groupError
  if (!group) {
    const err = new Error('The class this claim was for no longer exists.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }
  const { data: school, error: schoolError } = await supabase.from('schools').select('name').eq('id', group.school_id).maybeSingle()
  if (schoolError) throw schoolError

  const className = `${claim.course_number} ${claim.display_name}`
  const teacherCode = await generateUniqueTeacherCode()

  const { data: newClass, error: classError } = await supabase
    .from('classes')
    .insert({
      teacher_id: claim.teacher_id,
      name: className,
      grade: group.grade,
      school: school?.name || null,
      school_id: group.school_id,
      subject: group.subject,
      course_number: claim.course_number,
      group_id: group.id,
      teacher_code: teacherCode,
    })
    .select()
    .single()
  if (classError) throw classError

  const { error: updateError } = await supabase
    .from('teacher_claims')
    .update({ status: 'approved', resolved_at: new Date().toISOString(), created_class_id: newClass.id })
    .eq('id', claimId)
  if (updateError) throw updateError

  const { title, body: notifBody } = notificationText('class_claim_approved', teacher?.language_preference, {
    className,
    teacherCode,
  })
  await insertNotification({ userId: claim.teacher_id, type: 'class_claim_approved', title, body: notifBody, data: { claim_id: claimId, class_id: newClass.id } })
  await sendPushToUser({ userId: claim.teacher_id, type: 'class_claim_approved', title, body: notifBody, url: 'https://zyndal.ca' })
  if (teacher?.email) {
    await sendClassClaimApprovedEmail({ email: teacher.email, languagePreference: teacher.language_preference }).catch((err) =>
      console.error('[resolve-teacher-claim] failed to send approval email:', err)
    )
  }

  return { claim: { ...claim, status: 'approved', created_class_id: newClass.id }, class: newClass }
}

export default createAdminHandler({ method: 'POST', validate, handle })
