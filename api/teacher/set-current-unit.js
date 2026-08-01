import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeInteger, sanitizeString } from '../_lib/sanitize.js'

function validate(body) {
  const classId = sanitizeUuid(body.class_id)
  if (!classId) return { field: 'class_id', message: 'A valid class_id is required.' }
  body.class_id = classId

  const unitNumber = sanitizeInteger(body.current_unit_number, 1, 50)
  if (!unitNumber) return { field: 'current_unit_number', message: 'current_unit_number must be a whole number between 1 and 50.' }
  body.current_unit_number = unitNumber

  const unitTitle = sanitizeString(body.current_unit_title, 200)
  if (!unitTitle) return { field: 'current_unit_title', message: 'current_unit_title is required.' }
  body.current_unit_title = unitTitle

  return null
}

async function handle({ teacherId, body }) {
  const { data: classRow, error: classError } = await supabase.from('classes').select('teacher_id').eq('id', body.class_id).maybeSingle()
  if (classError) throw classError
  if (!classRow || classRow.teacher_id !== teacherId) {
    const err = new Error('Class not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const { data: updated, error: updateError } = await supabase
    .from('classes')
    .update({ current_unit_number: body.current_unit_number, current_unit_title: body.current_unit_title })
    .eq('id', body.class_id)
    .select()
    .single()
  if (updateError) throw updateError

  return { class: updated }
}

export default createTeacherHandler({ method: 'POST', validate, handle })
