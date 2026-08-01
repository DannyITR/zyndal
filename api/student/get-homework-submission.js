import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

function validate(body) {
  const assignmentId = sanitizeUuid(body.assignment_id)
  if (!assignmentId) return { field: 'assignment_id', message: 'A valid assignment_id is required.' }
  body.assignment_id = assignmentId
  return null
}

// Mirrors api/teacher/get-submission-detail.js but self-scoped — a student
// can only ever read back their own completed answers, never another
// student's. get-homework.js deliberately omits `questions` for completed
// assignments (see its own comment); this is the on-demand read-only detail
// view for a homework the student has already finished.
async function handle({ userId, body }) {
  const { data: assignment, error: assignmentError } = await supabase
    .from('homework_assignments')
    .select('*')
    .eq('id', body.assignment_id)
    .maybeSingle()
  if (assignmentError) throw assignmentError
  if (!assignment) {
    const err = new Error('Assignment not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const { data: enrollment, error: enrollError } = await supabase
    .from('class_students')
    .select('id')
    .eq('class_id', assignment.class_id)
    .eq('student_id', userId)
    .maybeSingle()
  if (enrollError) throw enrollError
  if (!enrollment) {
    const err = new Error('You are not enrolled in this class.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  const { data: submission, error: submissionError } = await supabase
    .from('homework_submissions')
    .select('*')
    .eq('assignment_id', body.assignment_id)
    .eq('student_id', userId)
    .maybeSingle()
  if (submissionError) throw submissionError

  return {
    questions: assignment.questions,
    submitted: Boolean(submission?.completed_at),
    answers: submission?.answers ?? null,
    scorePercentage: submission?.score_percentage ?? null,
    completedAt: submission?.completed_at ?? null,
  }
}

export default createStudentHandler({ method: 'GET', validate, handle })
