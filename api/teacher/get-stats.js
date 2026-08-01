import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { todayStr } from '../../src/lib/streak.js'

// "Active today"/"due this week" are aggregate teacher-dashboard numbers,
// not per-student precision-critical ones — matches api/admin/get-stats.js's
// own UTC-based "today" convention rather than resolving each student's own
// timezone.
async function handle({ teacherId }) {
  const { data: classes, error: classesError } = await supabase.from('classes').select('id').eq('teacher_id', teacherId)
  if (classesError) throw classesError
  const classIds = (classes || []).map((c) => c.id)

  if (classIds.length === 0) {
    return { totalClasses: 0, totalStudents: 0, activeToday: 0, assignmentsDueThisWeek: 0 }
  }

  const { data: enrollments, error: enrollError } = await supabase.from('class_students').select('student_id').in('class_id', classIds)
  if (enrollError) throw enrollError
  const studentIds = [...new Set((enrollments || []).map((e) => e.student_id))]

  const today = todayStr()
  const todayStart = `${today}T00:00:00.000Z`
  const [answersResult, assignmentsResult] = await Promise.all([
    studentIds.length
      ? supabase.from('answers').select('user_id').in('user_id', studentIds).gte('answered_at', todayStart)
      : { data: [] },
    supabase.from('homework_assignments').select('due_date').in('class_id', classIds),
  ])
  if (answersResult.error) throw answersResult.error
  if (assignmentsResult.error) throw assignmentsResult.error

  const activeToday = new Set((answersResult.data || []).map((a) => a.user_id)).size

  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const assignmentsDueThisWeek = (assignmentsResult.data || []).filter((a) => a.due_date >= today && a.due_date <= weekFromNow).length

  return {
    totalClasses: classIds.length,
    totalStudents: studentIds.length,
    activeToday,
    assignmentsDueThisWeek,
  }
}

export default createTeacherHandler({ method: 'GET', handle })
