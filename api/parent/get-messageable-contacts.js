import { createParentHandler } from '../_lib/parentHandler.js'
import { supabase } from '../_lib/auth.js'

// Powers ParentNewConversationModal.jsx's picker — a parent's "start a new
// conversation" flow only ever offers their own linked child(ren) or that
// child's own teacher(s), matching exactly what
// api/_lib/messaging.js's verifyConversationAllowed will actually permit
// for a parent+student or parent+teacher pairing (same parent_student ->
// class_students -> classes.teacher_id join that check uses).
async function handle({ parentId }) {
  const { data: links, error: linksError } = await supabase.from('parent_student').select('student_id').eq('parent_id', parentId)
  if (linksError) throw linksError
  const studentIds = (links || []).map((l) => l.student_id)
  if (studentIds.length === 0) return { children: [] }

  const { data: students, error: studentsError } = await supabase.from('users').select('id, username, avatar').in('id', studentIds)
  if (studentsError) throw studentsError

  const { data: enrollments, error: enrollError } = await supabase.from('class_students').select('student_id, class_id').in('student_id', studentIds)
  if (enrollError) throw enrollError
  const classIds = [...new Set((enrollments || []).map((e) => e.class_id))]

  const { data: classes, error: classesError } = classIds.length
    ? await supabase.from('classes').select('id, teacher_id').in('id', classIds)
    : { data: [] }
  if (classesError) throw classesError
  const teacherIdByClass = Object.fromEntries((classes || []).map((c) => [c.id, c.teacher_id]))

  const teacherIdsByStudent = {}
  for (const e of enrollments || []) {
    const teacherId = teacherIdByClass[e.class_id]
    if (!teacherId) continue
    ;(teacherIdsByStudent[e.student_id] ||= new Set()).add(teacherId)
  }

  const allTeacherIds = [...new Set(Object.values(teacherIdsByStudent).flatMap((s) => [...s]))]
  const { data: teachers, error: teachersError } = allTeacherIds.length
    ? await supabase.from('users').select('id, username, avatar').in('id', allTeacherIds)
    : { data: [] }
  if (teachersError) throw teachersError
  const teacherById = Object.fromEntries((teachers || []).map((t) => [t.id, t]))

  return {
    children: (students || []).map((s) => ({
      id: s.id,
      username: s.username,
      avatar: s.avatar,
      teachers: [...(teacherIdsByStudent[s.id] || [])].map((tid) => teacherById[tid]).filter(Boolean),
    })),
  }
}

export default createParentHandler({ method: 'GET', handle })
