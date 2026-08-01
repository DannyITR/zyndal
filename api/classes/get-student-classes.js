import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

async function handle({ userId }) {
  const { data: enrollments, error } = await supabase.from('class_students').select('class_id, joined_at').eq('student_id', userId)
  if (error) throw error
  if (!enrollments || enrollments.length === 0) return { classes: [] }

  const classIds = enrollments.map((e) => e.class_id)
  const { data: classes, error: classesError } = await supabase.from('classes').select('*').in('id', classIds)
  if (classesError) throw classesError

  const teacherIds = [...new Set((classes || []).map((c) => c.teacher_id))]
  const { data: teachers, error: teachersError } = teacherIds.length
    ? await supabase.from('users').select('id, username').in('id', teacherIds)
    : { data: [] }
  if (teachersError) throw teachersError
  const teacherUsernameById = Object.fromEntries((teachers || []).map((t) => [t.id, t.username]))
  const joinedAtByClass = Object.fromEntries(enrollments.map((e) => [e.class_id, e.joined_at]))

  return {
    classes: (classes || []).map((c) => ({
      id: c.id,
      name: c.name,
      grade: c.grade,
      school: c.school,
      teacherUsername: teacherUsernameById[c.teacher_id] || 'Unknown',
      currentUnitNumber: c.current_unit_number ?? 1,
      currentUnitTitle: c.current_unit_title || null,
      createdAt: c.created_at,
      joinedAt: joinedAtByClass[c.id],
    })),
  }
}

export default createStudentHandler({ method: 'GET', handle })
