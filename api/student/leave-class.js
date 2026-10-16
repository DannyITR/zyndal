import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { coreSubjectOf } from '../_lib/classLeaves.js'
import { todayStr, isValidTimeZone, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'

// Leaving deletes the one membership row — every consumer that gates on
// membership (get-school-subject-groups.js's My Subjects grid,
// api/_lib/forumAuth.js's forum access, homework assignment queries, a
// teacher's class roster) reads these same tables live, so removal there is
// automatic and needs no separate cleanup. Historical answers/grades/
// uploads carry no FK to either membership table (see schema.sql), so
// they're untouched by design — leaving only affects forward-looking access.
//
// A core class (a core-subject group, or a teacher's class in a core
// subject) is also recorded in class_leaves — see api/_lib/classLeaves.js —
// so it moves to Electives with a Join button (api/student/rejoin-class.js),
// nothing re-adds the student automatically, and Today's Question skips
// that subject for them while they're out. Electives are left as before,
// with no record: their own Join button / class code already brings them
// back.
function validate(body) {
  if (body.class_type !== 'group' && body.class_type !== 'class') return { field: 'class_type', message: 'class_type must be "group" or "class".' }
  const classId = sanitizeUuid(body.class_id)
  if (!classId) return { field: 'class_id', message: 'class_id must be a valid id.' }
  body.class_id = classId
  return null
}

async function handle({ userId, body }) {
  const { class_type: classType, class_id: classId } = body

  const coreSubject = await coreSubjectOf(classType, classId)
  if (coreSubject) {
    // left_on is the student's own calendar day, so Today's Question
    // changes from the day they left, not from a UTC boundary.
    const timezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE
    const { error } = await supabase
      .from('class_leaves')
      .upsert(
        { user_id: userId, class_type: classType, class_id: classId, subject: coreSubject, left_on: todayStr(new Date(), timezone) },
        { onConflict: 'user_id,class_type,class_id', ignoreDuplicates: true }
      )
    if (error) throw error
  }

  if (classType === 'group') {
    const { error } = await supabase.from('school_subject_group_students').delete().eq('group_id', classId).eq('student_id', userId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('class_students').delete().eq('class_id', classId).eq('student_id', userId)
    if (error) throw error
  }

  return { success: true }
}

export default createStudentHandler({ method: 'POST', validate, handle })
