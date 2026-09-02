import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

// Leaving is just deleting the one membership row — every consumer that
// gates on membership (get-school-subject-groups.js's My Subjects grid,
// api/_lib/forumAuth.js's forum access, homework assignment queries) reads
// these same tables live, so removal there is automatic and needs no
// separate cleanup. Historical answers/grades carry no FK to either
// membership table (see schema.sql), so they're untouched by design —
// leaving only affects forward-looking access, not past records.
function validate(body) {
  if (body.class_type !== 'group' && body.class_type !== 'class') return { field: 'class_type', message: 'class_type must be "group" or "class".' }
  const classId = sanitizeUuid(body.class_id)
  if (!classId) return { field: 'class_id', message: 'class_id must be a valid id.' }
  body.class_id = classId
  return null
}

async function handle({ userId, body }) {
  const { class_type: classType, class_id: classId } = body

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
