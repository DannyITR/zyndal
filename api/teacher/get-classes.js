import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { todayStr } from '../../src/lib/streak.js'

async function handle({ teacherId }) {
  const { data: classes, error } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!classes || classes.length === 0) return { classes: [] }

  const classIds = classes.map((c) => c.id)
  const [{ data: studentRows, error: studentsError }, { data: assignmentRows, error: assignmentsError }] = await Promise.all([
    supabase.from('class_students').select('class_id').in('class_id', classIds),
    supabase.from('homework_assignments').select('class_id, due_date').in('class_id', classIds),
  ])
  if (studentsError) throw studentsError
  if (assignmentsError) throw assignmentsError

  const studentCountByClass = {}
  for (const row of studentRows || []) studentCountByClass[row.class_id] = (studentCountByClass[row.class_id] || 0) + 1

  // "Active" = not yet past its due date — a simple, class-timezone-agnostic
  // definition that's good enough for a summary count on this list screen
  // (Class Detail shows the real per-assignment completion state).
  const today = todayStr()
  const activeAssignmentCountByClass = {}
  for (const row of assignmentRows || []) {
    if (row.due_date >= today) activeAssignmentCountByClass[row.class_id] = (activeAssignmentCountByClass[row.class_id] || 0) + 1
  }

  return {
    classes: classes.map((c) => ({
      ...c,
      studentCount: studentCountByClass[c.id] || 0,
      activeAssignmentCount: activeAssignmentCountByClass[c.id] || 0,
    })),
  }
}

export default createTeacherHandler({ method: 'GET', handle })
