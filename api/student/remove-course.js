import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeInteger } from '../_lib/sanitize.js'
import { findCourseGroup } from '../_lib/studentCourses.js'

// Removes a course added from another grade (see add-course.js): deletes
// the student_courses row and leaves that grade's group. The student's
// uploads, practice history and grades from the course are kept. A
// teacher-claimed class they joined with a code is a separate membership
// with its own card and Leave button, so it's left alone. Never touches a
// group at the student's own grade.
function validate(body) {
  if (typeof body.subject !== 'string' || !body.subject) return { field: 'subject', message: 'subject is required.' }
  const grade = sanitizeInteger(body.grade, 1, 12)
  if (grade === null) return { field: 'grade', message: 'grade must be a whole number.' }
  body.grade = grade
  return null
}

async function handle({ userId, body }) {
  const { subject, grade } = body
  const { data: user, error: userError } = await supabase.from('users').select('school_id, grade').eq('id', userId).maybeSingle()
  if (userError) throw userError

  const { error: deleteError } = await supabase.from('student_courses').delete().eq('user_id', userId).eq('subject', subject).eq('grade', grade)
  if (deleteError) throw deleteError

  if (user?.school_id && Number(user.grade) !== grade) {
    const group = await findCourseGroup(user.school_id, subject, grade)
    if (group) {
      const { error } = await supabase.from('school_subject_group_students').delete().eq('group_id', group.id).eq('student_id', userId)
      if (error) throw error
    }
  }

  return { success: true }
}

export default createStudentHandler({ method: 'POST', validate, handle })
