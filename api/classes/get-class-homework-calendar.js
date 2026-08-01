import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeInteger } from '../_lib/sanitize.js'
import { todayStr, isValidTimeZone, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'

function pad(n) {
  return String(n).padStart(2, '0')
}

function validate(body) {
  const classId = sanitizeUuid(body.class_id)
  if (!classId) return { field: 'class_id', message: 'A valid class_id is required.' }
  body.class_id = classId

  const month = sanitizeInteger(body.month, 1, 12)
  if (!month) return { field: 'month', message: 'month must be a whole number between 1 and 12.' }
  body.month = month

  const year = sanitizeInteger(body.year, 2020, 2100)
  if (!year) return { field: 'year', message: 'year must be a whole number between 2020 and 2100.' }
  body.year = year

  return null
}

async function handle({ userId, body }) {
  const { data: enrollment, error: enrollError } = await supabase
    .from('class_students')
    .select('id')
    .eq('class_id', body.class_id)
    .eq('student_id', userId)
    .maybeSingle()
  if (enrollError) throw enrollError
  if (!enrollment) {
    const err = new Error('You are not enrolled in this class.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  const firstDay = `${body.year}-${pad(body.month)}-01`
  const lastDayNum = new Date(Date.UTC(body.year, body.month, 0)).getUTCDate()
  const lastDay = `${body.year}-${pad(body.month)}-${pad(lastDayNum)}`

  const { data: assignments, error: assignmentsError } = await supabase
    .from('homework_assignments')
    .select('id, title, subject, due_date, questions')
    .eq('class_id', body.class_id)
    .gte('due_date', firstDay)
    .lte('due_date', lastDay)
    .order('due_date', { ascending: true })
  if (assignmentsError) throw assignmentsError
  if (!assignments || assignments.length === 0) return { assignments: [] }

  const assignmentIds = assignments.map((a) => a.id)
  const { data: submissions, error: submissionsError } = await supabase
    .from('homework_submissions')
    .select('assignment_id, score_percentage, completed_at')
    .eq('student_id', userId)
    .in('assignment_id', assignmentIds)
  if (submissionsError) throw submissionsError
  const submissionByAssignment = Object.fromEntries((submissions || []).map((s) => [s.assignment_id, s]))

  const timezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE
  const today = todayStr(new Date(), timezone)

  return {
    assignments: assignments.map((a) => {
      const submission = submissionByAssignment[a.id]
      const completed = Boolean(submission?.completed_at)
      return {
        id: a.id,
        title: a.title,
        subject: a.subject,
        dueDate: a.due_date,
        questionCount: Array.isArray(a.questions) ? a.questions.length : 0,
        completed,
        scorePercentage: submission?.score_percentage ?? null,
        completedAt: submission?.completed_at ?? null,
        overdue: !completed && a.due_date < today,
      }
    }),
  }
}

export default createStudentHandler({ method: 'GET', validate, handle })
