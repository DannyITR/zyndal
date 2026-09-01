import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeString, sanitizeUrl } from '../_lib/sanitize.js'

// Temporarily off for testing, so a claim can be submitted with any email —
// flip back to true to require the teacher's account email to end in the
// school's own domain again. Mirrors PREMIUM_ENFORCEMENT_ENABLED
// (api/_lib/subscription.js)'s same temporary-disable-flag pattern.
const EMAIL_DOMAIN_CHECK_ENABLED = false

function validate(body) {
  const groupId = sanitizeUuid(body.group_id)
  if (!groupId) return { field: 'group_id', message: 'group_id must be a valid group id.' }
  body.group_id = groupId

  const bioLink = sanitizeUrl(body.bio_link)
  if (!bioLink) return { field: 'bio_link', message: 'bio_link must be a valid http(s) URL.' }
  body.bio_link = bioLink

  const courseNumber = sanitizeString(body.course_number, 50)
  if (!courseNumber) return { field: 'course_number', message: 'course_number is required.' }
  body.course_number = courseNumber

  const displayName = sanitizeString(body.display_name, 50)
  if (!displayName) return { field: 'display_name', message: 'display_name is required.' }
  body.display_name = displayName

  return null
}

async function handle({ teacherId, body }) {
  const { group_id: groupId, bio_link: bioLink, course_number: courseNumber, display_name: displayName } = body

  const { data: group, error: groupError } = await supabase.from('school_subject_groups').select('id, school_id').eq('id', groupId).maybeSingle()
  if (groupError) throw groupError
  if (!group) {
    const err = new Error('That class was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  if (EMAIL_DOMAIN_CHECK_ENABLED) {
    const { data: school, error: schoolError } = await supabase.from('schools').select('domain').eq('id', group.school_id).maybeSingle()
    if (schoolError) throw schoolError

    const { data: teacher, error: teacherError } = await supabase.from('users').select('email').eq('id', teacherId).maybeSingle()
    if (teacherError) throw teacherError

    const domain = (school?.domain || '').toLowerCase()
    const email = (teacher?.email || '').toLowerCase()
    if (!domain || !email || !email.endsWith(`@${domain}`)) {
      const err = new Error(`Your account email must end in @${domain || 'the school’s domain'} to claim a class at this school.`)
      err.status = 400
      err.code = 'EMAIL_DOMAIN_MISMATCH'
      throw err
    }
  }

  // A pending or already-approved claim by this same teacher for this same
  // group blocks resubmission — a rejected one doesn't (see
  // ClaimClassScreen.jsx's "tap to try again").
  const { data: existing, error: existingError } = await supabase
    .from('teacher_claims')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('group_id', groupId)
    .in('status', ['pending', 'approved'])
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) {
    const err = new Error('You already have a claim in progress for this class.')
    err.status = 400
    err.code = 'ALREADY_CLAIMED'
    throw err
  }

  const { data: claim, error: insertError } = await supabase
    .from('teacher_claims')
    .insert({ teacher_id: teacherId, group_id: groupId, bio_link: bioLink, course_number: courseNumber, display_name: displayName, status: 'pending' })
    .select()
    .single()
  if (insertError) throw insertError

  return { claim }
}

export default createTeacherHandler({ method: 'POST', validate, handle })
