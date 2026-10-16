import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeInteger } from '../_lib/sanitize.js'
import { findCourseGroup } from '../_lib/studentCourses.js'
import { isOfferedCourse } from '../../src/lib/additionalCourses.js'

// Adds a course from another grade (e.g. Gr 10 Math for a Gr 11 student)
// as an extra enrollment in student_courses — users.grade is untouched —
// and joins the student to their school's group for it, so it shows as its
// own Class Card with that grade's content. Only combos listed in
// src/lib/additionalCourses.js for the student's grade are accepted.
// Available to every user; not premium-gated.
function validate(body) {
  if (typeof body.subject !== 'string' || !body.subject) return { field: 'subject', message: 'subject is required.' }
  const grade = sanitizeInteger(body.grade, 1, 12)
  if (grade === null) return { field: 'grade', message: 'grade must be a whole number.' }
  body.grade = grade
  return null
}

function fail(status, code, message) {
  const err = new Error(message)
  err.status = status
  err.code = code
  return err
}

async function handle({ userId, body }) {
  const { subject, grade } = body
  const { data: user, error: userError } = await supabase.from('users').select('account_type, school_id, grade').eq('id', userId).maybeSingle()
  if (userError) throw userError
  if (!user || user.account_type !== 'student') throw fail(403, 'FORBIDDEN', 'Only students can add courses.')
  if (!isOfferedCourse(user.grade, subject, grade)) throw fail(400, 'COURSE_NOT_OFFERED', "That course can't be added for your grade.")
  if (!user.school_id) throw fail(400, 'NO_SCHOOL', 'Set your school first.')

  const group = await findCourseGroup(user.school_id, subject, grade)
  if (!group) throw fail(404, 'COURSE_NOT_AT_SCHOOL', "Your school doesn't offer that course.")

  const { error: insertError } = await supabase
    .from('student_courses')
    .upsert({ user_id: userId, subject, grade }, { onConflict: 'user_id,subject,grade', ignoreDuplicates: true })
  if (insertError) throw insertError

  const { error: joinError } = await supabase
    .from('school_subject_group_students')
    .upsert({ group_id: group.id, student_id: userId }, { onConflict: 'group_id,student_id', ignoreDuplicates: true })
  if (joinError) throw joinError

  return { subject, grade, groupId: group.id }
}

export default createStudentHandler({ method: 'POST', validate, handle })
