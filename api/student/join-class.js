import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

function validate(body) {
  if (!body.teacher_code || typeof body.teacher_code !== 'string' || !body.teacher_code.trim()) {
    return { field: 'teacher_code', message: 'Class code is required.' }
  }
  body.teacher_code = body.teacher_code.trim().toUpperCase()
  return null
}

async function handle({ userId, body }) {
  const { data: classRow, error: classError } = await supabase
    .from('classes')
    .select('id, name, grade, school, teacher_id')
    .eq('teacher_code', body.teacher_code)
    .maybeSingle()
  if (classError) throw classError
  if (!classRow) {
    const err = new Error('That class code was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const { data: teacher, error: teacherError } = await supabase.from('users').select('username').eq('id', classRow.teacher_id).maybeSingle()
  if (teacherError) throw teacherError

  const { error: insertError } = await supabase.from('class_students').insert({ class_id: classRow.id, student_id: userId })
  if (insertError) {
    if (insertError.code === '23505') {
      const err = new Error("You're already in this class.")
      err.status = 400
      err.code = 'ALREADY_JOINED'
      throw err
    }
    throw insertError
  }

  return {
    class: {
      id: classRow.id,
      name: classRow.name,
      grade: classRow.grade,
      school: classRow.school,
      teacherUsername: teacher?.username || 'Unknown',
    },
  }
}

export default createStudentHandler({ method: 'POST', validate, handle })
