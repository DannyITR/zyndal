import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { insertNotification } from '../_lib/notifications.js'
import { notificationText } from '../_lib/notificationText.js'
import { sendPushToUser } from '../_lib/push.js'

// Scratchpad is Math-only — other subjects may be added in future.
// Teacher-side counterpart to grade-work.js's AI path — Math homework work
// submissions are reviewed by the teacher instead, via this endpoint.

function validate(body) {
  const id = sanitizeUuid(body.work_submission_id)
  if (!id) return { field: 'work_submission_id', message: 'A valid work_submission_id is required.' }
  body.work_submission_id = id

  if (typeof body.approved !== 'boolean') return { field: 'approved', message: 'approved must be true or false.' }

  return null
}

async function handle({ teacherId, body }) {
  const { data: submission, error: submissionError } = await supabase
    .from('work_submissions')
    .select('id, user_id, assignment_id, question_text, approved, review_type')
    .eq('id', body.work_submission_id)
    .maybeSingle()
  if (submissionError) throw submissionError
  if (!submission || submission.review_type !== 'teacher' || !submission.assignment_id) {
    const err = new Error('Work submission not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from('homework_assignments')
    .select('class_id')
    .eq('id', submission.assignment_id)
    .maybeSingle()
  if (assignmentError) throw assignmentError
  const { data: classRow, error: classError } = assignment
    ? await supabase.from('classes').select('teacher_id').eq('id', assignment.class_id).maybeSingle()
    : { data: null, error: null }
  if (classError) throw classError
  if (!classRow || classRow.teacher_id !== teacherId) {
    const err = new Error('Work submission not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  if (submission.approved !== null) {
    const err = new Error('This submission has already been reviewed.')
    err.status = 409
    err.code = 'ALREADY_REVIEWED'
    throw err
  }

  const xpEarned = body.approved ? 1 : 0
  const coinsEarned = body.approved ? 1 : 0

  const { error: updateError } = await supabase
    .from('work_submissions')
    .update({ approved: body.approved, xp_earned: xpEarned, coins_earned: coinsEarned, reviewed_at: new Date().toISOString() })
    .eq('id', submission.id)
  if (updateError) throw updateError

  if (body.approved) {
    const { data: streakRow, error: streakFetchError } = await supabase
      .from('streaks')
      .select('total_xp, coin_balance')
      .eq('user_id', submission.user_id)
      .maybeSingle()
    if (streakFetchError) throw streakFetchError
    if (streakRow) {
      const { error: streakUpdateError } = await supabase
        .from('streaks')
        .update({ total_xp: streakRow.total_xp + xpEarned, coin_balance: streakRow.coin_balance + coinsEarned })
        .eq('user_id', submission.user_id)
      if (streakUpdateError) throw streakUpdateError
    }
  }

  const { data: student } = await supabase.from('users').select('language_preference').eq('id', submission.user_id).maybeSingle()
  const notifType = body.approved ? 'work_approved' : 'work_rejected'
  const { title: notifTitle } = notificationText(notifType, student?.language_preference)
  await insertNotification({
    userId: submission.user_id,
    type: notifType,
    title: notifTitle,
    body: submission.question_text,
    data: { assignment_id: submission.assignment_id },
  })
  await sendPushToUser({
    userId: submission.user_id,
    type: notifType,
    title: notifTitle,
    body: submission.question_text,
    url: 'https://zyndal.ca',
  })

  return { approved: body.approved, xpEarned, coinsEarned }
}

export default createTeacherHandler({ method: 'POST', validate, handle })
