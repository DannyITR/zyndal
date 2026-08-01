import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'

const RECENT_LIMIT = 5

// Powers the teacher home screen's "Recent Homework" summary, which replaced
// the Assign Homework button/tab there (assigning now happens from inside
// each class's own detail page instead) — a quick glance at completion
// across every class without opening each one.
async function handle({ teacherId }) {
  const { data: classes, error: classesError } = await supabase.from('classes').select('id, name').eq('teacher_id', teacherId)
  if (classesError) throw classesError
  if (!classes || classes.length === 0) return { homework: [] }

  const classIds = classes.map((c) => c.id)
  const classNameById = Object.fromEntries(classes.map((c) => [c.id, c.name]))

  const { data: assignments, error: assignmentsError } = await supabase
    .from('homework_assignments')
    .select('id, class_id, title, subject, due_date')
    .in('class_id', classIds)
    .order('due_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT)
  if (assignmentsError) throw assignmentsError
  if (!assignments || assignments.length === 0) return { homework: [] }

  const assignmentIds = assignments.map((a) => a.id)
  const [{ data: enrollments, error: enrollError }, { data: submissions, error: submissionsError }] = await Promise.all([
    supabase.from('class_students').select('class_id').in('class_id', classIds),
    supabase.from('homework_submissions').select('assignment_id, completed_at').in('assignment_id', assignmentIds),
  ])
  if (enrollError) throw enrollError
  if (submissionsError) throw submissionsError

  const totalEnrolledByClass = {}
  for (const row of enrollments || []) totalEnrolledByClass[row.class_id] = (totalEnrolledByClass[row.class_id] || 0) + 1

  const completedCountByAssignment = {}
  for (const row of submissions || []) {
    if (row.completed_at) completedCountByAssignment[row.assignment_id] = (completedCountByAssignment[row.assignment_id] || 0) + 1
  }

  return {
    homework: assignments.map((a) => ({
      id: a.id,
      classId: a.class_id,
      className: classNameById[a.class_id] || 'Unknown class',
      title: a.title,
      subject: a.subject,
      dueDate: a.due_date,
      completedCount: completedCountByAssignment[a.id] || 0,
      totalEnrolled: totalEnrolledByClass[a.class_id] || 0,
    })),
  }
}

export default createTeacherHandler({ method: 'GET', handle })
