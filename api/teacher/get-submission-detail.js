import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'

function validate(body) {
  const assignmentId = sanitizeUuid(body.assignment_id)
  if (!assignmentId) return { field: 'assignment_id', message: 'A valid assignment_id is required.' }
  body.assignment_id = assignmentId

  const studentId = sanitizeUuid(body.student_id)
  if (!studentId) return { field: 'student_id', message: 'A valid student_id is required.' }
  body.student_id = studentId

  return null
}

// "Clicking a student shows their individual answers" — a dedicated,
// on-demand endpoint rather than embedding every student's full answer
// array in get-class-detail.js's response, which already returns
// per-assignment summaries for every student in the class.
async function handle({ teacherId, body }) {
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

  const { data: classRow, error: classError } = await supabase.from('classes').select('teacher_id').eq('id', assignment.class_id).maybeSingle()
  if (classError) throw classError
  if (!classRow || classRow.teacher_id !== teacherId) {
    const err = new Error('Assignment not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const { data: submission, error: submissionError } = await supabase
    .from('homework_submissions')
    .select('*')
    .eq('assignment_id', body.assignment_id)
    .eq('student_id', body.student_id)
    .maybeSingle()
  if (submissionError) throw submissionError

  // Scratchpad is Math-only — other subjects may be added in future.
  const { data: workSubmissions, error: workError } = await supabase
    .from('work_submissions')
    .select('id, question_index, image_base64, approved')
    .eq('assignment_id', body.assignment_id)
    .eq('user_id', body.student_id)
    .eq('review_type', 'teacher')
  if (workError) throw workError

  return {
    questions: assignment.questions,
    submitted: Boolean(submission?.completed_at),
    answers: submission?.answers ?? null,
    scorePercentage: submission?.score_percentage ?? null,
    completedAt: submission?.completed_at ?? null,
    workSubmissions: (workSubmissions || []).map((w) => ({
      id: w.id,
      questionIndex: w.question_index,
      imageBase64: w.image_base64,
      approved: w.approved,
    })),
  }
}

export default createTeacherHandler({ method: 'GET', validate, handle })
