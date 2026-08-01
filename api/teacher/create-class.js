import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { generateUniqueTeacherCode } from '../_lib/db.js'
import { sanitizeString, sanitizeGrade } from '../_lib/sanitize.js'

function validate(body) {
  const name = sanitizeString(body.name, 100)
  if (!name) return { field: 'name', message: 'Class name is required.' }
  body.name = name

  const grade = sanitizeGrade(body.grade)
  if (!grade) return { field: 'grade', message: 'Grade must be between 7 and 11.' }
  body.grade = grade

  const school = sanitizeString(body.school, 100)
  if (!school) return { field: 'school', message: 'School name is required.' }
  body.school = school

  return null
}

async function handle({ teacherId, body }) {
  const teacherCode = await generateUniqueTeacherCode()
  const { data, error } = await supabase
    .from('classes')
    .insert({ teacher_id: teacherId, name: body.name, grade: body.grade, school: body.school, teacher_code: teacherCode })
    .select()
    .single()
  if (error) throw error
  return { class: data }
}

export default createTeacherHandler({ method: 'POST', validate, handle })
