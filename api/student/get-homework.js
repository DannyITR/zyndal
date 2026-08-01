import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { todayStr, isValidTimeZone, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'

async function handle({ userId, body }) {
  const timezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE
  const today = todayStr(new Date(), timezone)

  const { data: enrollments, error: enrollError } = await supabase.from('class_students').select('class_id').eq('student_id', userId)
  if (enrollError) throw enrollError
  const classIds = (enrollments || []).map((e) => e.class_id)
  if (classIds.length === 0) return { homework: [] }

  const { data: assignments, error: assignmentsError } = await supabase
    .from('homework_assignments')
    .select('*')
    .in('class_id', classIds)
    .order('due_date', { ascending: true })
  if (assignmentsError) throw assignmentsError
  if (!assignments || assignments.length === 0) return { homework: [] }

  const assignmentIds = assignments.map((a) => a.id)
  const { data: submissions, error: submissionsError } = await supabase
    .from('homework_submissions')
    .select('assignment_id, score_percentage, completed_at')
    .eq('student_id', userId)
    .in('assignment_id', assignmentIds)
  if (submissionsError) throw submissionsError
  const submissionByAssignment = Object.fromEntries((submissions || []).map((s) => [s.assignment_id, s]))

  return {
    homework: assignments.map((a) => {
      const submission = submissionByAssignment[a.id]
      const completed = Boolean(submission?.completed_at)
      return {
        id: a.id,
        title: a.title,
        subject: a.subject,
        dueDate: a.due_date,
        completed,
        scorePercentage: submission?.score_percentage ?? null,
        overdue: !completed && a.due_date < today,
        // Only sent for homework the student can still open and answer —
        // no reason to ship the full question set (with correct answers)
        // for something already submitted, or to a caller just rendering
        // the completed line on the home screen.
        questions: completed ? undefined : a.questions,
      }
    }),
  }
}

export default createStudentHandler({ method: 'GET', handle })
