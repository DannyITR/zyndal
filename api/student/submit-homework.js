import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeImageBase64 } from '../_lib/sanitize.js'
import { todayStr, isValidTimeZone, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'

function validate(body) {
  const assignmentId = sanitizeUuid(body.assignment_id)
  if (!assignmentId) return { field: 'assignment_id', message: 'A valid assignment_id is required.' }
  body.assignment_id = assignmentId

  if (!Array.isArray(body.selected_indexes) || body.selected_indexes.length === 0) {
    return { field: 'selected_indexes', message: 'selected_indexes is required — answer every question before submitting.' }
  }
  if (body.selected_indexes.some((i) => !Number.isInteger(i) || i < 0 || i > 3)) {
    return { field: 'selected_indexes', message: 'Each selected index must be a whole number between 0 and 3.' }
  }

  // Scratchpad is Math-only — other subjects may be added in future.
  // Optional map of questionIndex -> canvas.toDataURL() PNG, for Math
  // assignments only (handle() ignores it entirely for other subjects).
  if (body.work_images !== undefined) {
    if (typeof body.work_images !== 'object' || body.work_images === null || Array.isArray(body.work_images)) {
      return { field: 'work_images', message: 'work_images must be an object.' }
    }
    const cleaned = {}
    for (const [key, value] of Object.entries(body.work_images)) {
      const idx = Number(key)
      if (!Number.isInteger(idx) || idx < 0) return { field: 'work_images', message: 'work_images keys must be valid question indexes.' }
      const image = sanitizeImageBase64(value)
      if (!image) return { field: 'work_images', message: 'Each work image must be valid image data.' }
      cleaned[idx] = image
    }
    body.work_images = cleaned
  }

  return null
}

// The whole assignment is graded and recorded in one call, submitted only
// once the student has answered every question — the student-facing
// HomeworkScreen walks through questions one at a time locally, but there's
// no partial-submission row; homework_submissions gets exactly one insert
// per (assignment, student), matching its own unique constraint.
async function handle({ userId, body }) {
  const timezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE
  const today = todayStr(new Date(), timezone)

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

  const questions = Array.isArray(assignment.questions) ? assignment.questions : []
  if (body.selected_indexes.length !== questions.length) {
    const err = new Error('You must answer every question before submitting.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  const { data: existing, error: existingError } = await supabase
    .from('homework_submissions')
    .select('id, completed_at')
    .eq('assignment_id', body.assignment_id)
    .eq('student_id', userId)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing?.completed_at) {
    const err = new Error('This homework has already been submitted.')
    err.status = 409
    err.code = 'ALREADY_SUBMITTED'
    throw err
  }

  // Late (past due_date) still counts and still earns XP, just no coins —
  // matches the daily question's "correct first attempt" coin rate exactly
  // for an on-time submission.
  const isLate = assignment.due_date < today
  let correctCount = 0
  const results = questions.map((q, i) => {
    const selectedIndex = body.selected_indexes[i]
    const correct = selectedIndex === q.correct
    if (correct) correctCount++
    return {
      question: q.question,
      options: q.options,
      selectedIndex,
      correctIndex: q.correct,
      correct,
      explanation: q.explanation,
    }
  })
  const scorePercentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0
  const xpEarned = correctCount
  const coinsEarned = isLate ? 0 : correctCount

  const { data: streakRow, error: streakFetchError } = await supabase.from('streaks').select('*').eq('user_id', userId).maybeSingle()
  if (streakFetchError) throw streakFetchError
  if (streakRow) {
    const { error: streakUpdateError } = await supabase
      .from('streaks')
      .update({ total_xp: streakRow.total_xp + xpEarned, coin_balance: streakRow.coin_balance + coinsEarned })
      .eq('user_id', userId)
    if (streakUpdateError) throw streakUpdateError
  }

  const answersPayload = body.selected_indexes.map((selectedIndex, i) => ({
    selectedIndex,
    correct: selectedIndex === questions[i].correct,
  }))

  const { error: submissionError } = await supabase.from('homework_submissions').upsert(
    {
      assignment_id: body.assignment_id,
      student_id: userId,
      answers: answersPayload,
      score_percentage: scorePercentage,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'assignment_id,student_id' }
  )
  if (submissionError) throw submissionError

  // Scratchpad is Math-only — other subjects may be added in future.
  // Pending teacher review, not AI-graded — see api/teacher/review-work.js.
  // Only correctly-answered questions get a row: the bonus is for showing
  // work behind a right answer, matching the daily-question path exactly.
  if (assignment.subject === 'math' && body.work_images) {
    const workRows = Object.entries(body.work_images)
      .filter(([idx]) => results[Number(idx)]?.correct)
      .map(([idx]) => ({
        user_id: userId,
        assignment_id: body.assignment_id,
        question_index: Number(idx),
        question_text: questions[Number(idx)].question,
        image_base64: body.work_images[idx],
        review_type: 'teacher',
        approved: null,
      }))
    if (workRows.length > 0) {
      const { error: workError } = await supabase.from('work_submissions').insert(workRows)
      if (workError) throw workError
    }
  }

  return { results, scorePercentage, xpEarned, coinsEarned, late: isLate }
}

export default createStudentHandler({ method: 'POST', validate, handle })
