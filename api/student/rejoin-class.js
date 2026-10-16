import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { hasLeftClass, clearClassLeave } from '../_lib/classLeaves.js'

// Rejoins a core class the student left (see leave-class.js /
// api/_lib/classLeaves.js): restores the membership row and clears the
// leave, so the card moves back to the core section, Today's Question
// includes the subject again, and a teacher's class roster lists them
// again. Their uploads, answers and grades were never removed, so nothing
// else needs restoring. Only works for a class they actually left — it
// can't be used to join a teacher's class without its code.
function validate(body) {
  if (body.class_type !== 'group' && body.class_type !== 'class') return { field: 'class_type', message: 'class_type must be "group" or "class".' }
  const classId = sanitizeUuid(body.class_id)
  if (!classId) return { field: 'class_id', message: 'class_id must be a valid id.' }
  body.class_id = classId
  return null
}

async function handle({ userId, body }) {
  const { class_type: classType, class_id: classId } = body
  if (!(await hasLeftClass(userId, classType, classId))) {
    const err = new Error("You haven't left that class.")
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const membership =
    classType === 'group'
      ? supabase.from('school_subject_group_students').upsert({ group_id: classId, student_id: userId }, { onConflict: 'group_id,student_id', ignoreDuplicates: true })
      : supabase.from('class_students').insert({ class_id: classId, student_id: userId })
  const { error: joinError } = await membership
  // 23505: already a member (e.g. rejoined with the class code meanwhile).
  if (joinError && joinError.code !== '23505') throw joinError

  await clearClassLeave(userId, classType, classId)

  return { success: true }
}

export default createStudentHandler({ method: 'POST', validate, handle })
