import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeImageBase64, sanitizeSubject } from '../_lib/sanitize.js'
import { generateJson } from '../_lib/anthropic.js'
import { resolveDailyQuestion } from '../_lib/dailyQuestion.js'
import { getProgressForUser } from '../_lib/db.js'
import { todayStr, isValidTimeZone, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'

// Scratchpad is Math-only — other subjects may be added in future.
//
// Three modes, all writing to the same work_submissions table:
//  - wrong_answer_review: AI reviews scratchpad work behind a WRONG pick,
//    before anything is submitted, and decides whether a corrected retry
//    earns full marks. Awards nothing itself.
//  - correct_work_submission: the original flow — grades scratchpad work
//    behind an already-submitted CORRECT answer for bonus XP/coin.
//  - retry_correct_log: records that a correct second attempt followed a
//    review, for the parent dashboard's "correct after hint" distinction.
//    The XP/coin themselves were already awarded by submit-answer.js's
//    normal flow (only the FINAL selection per subject/day is ever
//    submitted there) — this never awards anything on its own.

const MAX_ATTEMPTS_PER_ANSWER = 2
const MODES = ['correct_work_submission', 'wrong_answer_review', 'retry_correct_log']

const GRADE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    approved: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['approved', 'reason'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    has_work: { type: 'boolean' },
    error_step: { type: ['integer', 'null'] },
    feedback: { type: 'string' },
    on_right_track: { type: 'boolean' },
  },
  required: ['has_work', 'error_step', 'feedback', 'on_right_track'],
}

function validate(body) {
  if (!MODES.includes(body.mode)) return { field: 'mode', message: `mode must be one of: ${MODES.join(', ')}.` }

  const image = sanitizeImageBase64(body.image_base64)
  if (!image) return { field: 'image_base64', message: 'image_base64 is required.' }
  body.image_base64 = image

  if (body.mode === 'wrong_answer_review') {
    const subject = sanitizeSubject(body.subject)
    if (subject !== 'math') return { field: 'subject', message: 'Work review is only available for Math questions.' }
    body.subject = subject
    body.timezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE
    return null
  }

  // correct_work_submission and retry_correct_log both operate on an
  // already-submitted answer.
  const answerId = sanitizeUuid(body.answer_id)
  if (!answerId) return { field: 'answer_id', message: 'A valid answer_id is required.' }
  body.answer_id = answerId
  return null
}

// Deliberately NOT the { image_base64, question_text, correct_answer }
// request shape as originally specified for correct_work_submission — a
// client-supplied question_text/correct_answer would let anyone forge a
// matching pair via curl and farm the bonus regardless of what they
// actually answered. Instead the client sends only answer_id (from
// submit-answer.js's response) and the server looks up that row itself.
// wrong_answer_review follows the same principle from the other
// direction: since nothing has been submitted yet, the server resolves
// today's actual question itself (resolveDailyQuestion) rather than
// trusting anything the client claims about it.
async function handleWrongAnswerReview({ userId, body }) {
  const { subject, timezone, image_base64 } = body
  const today = todayStr(new Date(), timezone)

  const progress = await getProgressForUser(userId, timezone)
  const alreadyAnswered = progress.history.some((h) => h.date === today && h.subjectId === subject)
  if (alreadyAnswered) {
    const err = new Error("Today's Math question has already been answered.")
    err.status = 409
    err.code = 'ALREADY_ANSWERED'
    throw err
  }

  const question = await resolveDailyQuestion({ userId, subject, timezone })
  const correctAnswerText = question.options[question.correctIndex]

  // One review per question — the client mirrors this with its own
  // usedRetry flag, but this is the authoritative guard against spamming
  // Claude calls without ever finalizing an answer.
  const { data: existingReview, error: existingError } = await supabase
    .from('work_submissions')
    .select('id')
    .eq('user_id', userId)
    .eq('question_text', question.prompt)
    .eq('review_type', 'ai')
    .eq('attempt_number', 1)
    .is('answer_id', null)
    .maybeSingle()
  if (existingError) throw existingError
  if (existingReview) {
    const err = new Error("You've already used your review for this question.")
    err.status = 409
    err.code = 'ALREADY_REVIEWED'
    throw err
  }

  let review
  try {
    review = await generateJson({
      system:
        "You are a math tutor reviewing a student's handwritten work. The student answered incorrectly. Review their work step by step and identify exactly where the error occurred. Return only JSON: { has_work: boolean (did the student show any real mathematical steps), error_step: number or null (which step contains the first error, null if no clear steps), feedback: string (specific, encouraging feedback explaining exactly where they went wrong and what to fix — one or two sentences, reference the specific step), on_right_track: boolean (was their approach correct even if they made an arithmetic error) }",
      schema: REVIEW_SCHEMA,
      maxTokens: 400,
      content: [
        {
          type: 'text',
          text: `The question was: ${question.prompt}. The correct answer is: ${correctAnswerText}. Look at the student's handwritten work in the image.`,
        },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image_base64 } },
      ],
    })
  } catch (err) {
    console.error('[grade-work] wrong-answer review failed:', err)
    const failure = new Error('Could not review your work right now. Please try again.')
    failure.status = 502
    failure.code = 'REVIEW_FAILED'
    throw failure
  }

  const { error: insertError } = await supabase.from('work_submissions').insert({
    user_id: userId,
    answer_id: null,
    question_text: question.prompt,
    image_base64,
    review_type: 'ai',
    approved: null,
    feedback_given: review.feedback || null,
    xp_earned: 0,
    coins_earned: 0,
    attempt_number: 1,
  })
  if (insertError) throw insertError

  return {
    has_work: Boolean(review.has_work),
    error_step: review.error_step ?? null,
    feedback: review.feedback || '',
    on_right_track: Boolean(review.on_right_track),
  }
}

async function handleCorrectWorkSubmission({ userId, body }) {
  const { answer_id, image_base64 } = body

  const { data: answerRow, error: answerError } = await supabase
    .from('answers')
    .select('id, user_id, subject, question_text, selected_answer, correct')
    .eq('id', answer_id)
    .maybeSingle()
  if (answerError) throw answerError
  if (!answerRow || answerRow.user_id !== userId) {
    const err = new Error('Answer not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (answerRow.subject !== 'math') {
    const err = new Error('Work submissions are only available for Math questions.')
    err.status = 400
    err.code = 'NOT_MATH'
    throw err
  }
  if (!answerRow.correct) {
    const err = new Error('No bonus available — this question wasn’t answered correctly.')
    err.status = 400
    err.code = 'NOT_CORRECT'
    throw err
  }

  // Scoped to review_type + feedback_given IS NULL so a retry_correct_log
  // row (which also carries this answer_id once a retry succeeds) never
  // counts against this endpoint's own 2-attempt cap — that row isn't a
  // bonus-grading attempt at all, just a record of the retry outcome.
  const { data: priorSubmissions, error: priorError } = await supabase
    .from('work_submissions')
    .select('id, approved')
    .eq('answer_id', answer_id)
    .eq('review_type', 'ai')
    .is('feedback_given', null)
  if (priorError) throw priorError
  if ((priorSubmissions || []).some((s) => s.approved === true)) {
    const err = new Error('You’ve already earned the bonus for this question.')
    err.status = 409
    err.code = 'ALREADY_APPROVED'
    throw err
  }
  if ((priorSubmissions || []).length >= MAX_ATTEMPTS_PER_ANSWER) {
    const err = new Error('You’ve already used your resubmission for this question.')
    err.status = 409
    err.code = 'NO_ATTEMPTS_LEFT'
    throw err
  }

  // correct === true, so selected_answer IS the correct answer's text —
  // no separate lookup needed.
  const correctAnswerText = answerRow.selected_answer

  let graded
  try {
    graded = await generateJson({
      system:
        "You are grading a student's handwritten math work. Determine if the work shows a genuine attempt to solve this problem with reasonable mathematical steps. Partial working out, a diagram, or key steps are sufficient. Return only JSON: { approved: boolean, reason: string (one sentence) }",
      schema: GRADE_SCHEMA,
      maxTokens: 300,
      content: [
        {
          type: 'text',
          text: `The question was: ${answerRow.question_text}. The correct answer is: ${correctAnswerText}. Look at the student's handwritten work in the image.`,
        },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image_base64 } },
      ],
    })
  } catch (err) {
    console.error('[grade-work] Claude grading failed:', err)
    const failure = new Error('Could not grade your work right now. Please try again.')
    failure.status = 502
    failure.code = 'GRADING_FAILED'
    throw failure
  }

  const approved = Boolean(graded.approved)
  const xpEarned = approved ? 1 : 0
  const coinsEarned = approved ? 1 : 0

  const { error: insertError } = await supabase.from('work_submissions').insert({
    user_id: userId,
    answer_id,
    question_text: answerRow.question_text,
    image_base64,
    review_type: 'ai',
    approved,
    ai_reason: graded.reason || null,
    xp_earned: xpEarned,
    coins_earned: coinsEarned,
    reviewed_at: new Date().toISOString(),
    attempt_number: (priorSubmissions || []).length + 1,
  })
  if (insertError) throw insertError

  if (approved) {
    const { data: streakRow, error: streakFetchError } = await supabase
      .from('streaks')
      .select('total_xp, coin_balance')
      .eq('user_id', userId)
      .maybeSingle()
    if (streakFetchError) throw streakFetchError
    if (streakRow) {
      const { error: streakUpdateError } = await supabase
        .from('streaks')
        .update({ total_xp: streakRow.total_xp + xpEarned, coin_balance: streakRow.coin_balance + coinsEarned })
        .eq('user_id', userId)
      if (streakUpdateError) throw streakUpdateError
    }
  }

  return {
    approved,
    reason: graded.reason || '',
    xp_earned: xpEarned,
    coins_earned: coinsEarned,
  }
}

async function handleRetryCorrectLog({ userId, body }) {
  const { answer_id, image_base64 } = body

  const { data: answerRow, error: answerError } = await supabase
    .from('answers')
    .select('id, user_id, subject, question_text, correct')
    .eq('id', answer_id)
    .maybeSingle()
  if (answerError) throw answerError
  if (!answerRow || answerRow.user_id !== userId) {
    const err = new Error('Answer not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (answerRow.subject !== 'math' || !answerRow.correct) {
    const err = new Error('This log is only valid for a correct Math answer.')
    err.status = 400
    err.code = 'INVALID_STATE'
    throw err
  }

  // Idempotent — a retried network call must not create a second log row.
  const { data: existing, error: existingError } = await supabase
    .from('work_submissions')
    .select('id')
    .eq('answer_id', answer_id)
    .eq('attempt_number', 2)
    .not('feedback_given', 'is', null)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return { logged: true }

  const { error: insertError } = await supabase.from('work_submissions').insert({
    user_id: userId,
    answer_id,
    question_text: answerRow.question_text,
    image_base64,
    review_type: 'ai',
    approved: true,
    feedback_given: 'Corrected after a hint.',
    xp_earned: 1,
    coins_earned: 1,
    attempt_number: 2,
  })
  if (insertError) throw insertError

  return { logged: true }
}

async function handle({ userId, body }) {
  if (body.mode === 'wrong_answer_review') return handleWrongAnswerReview({ userId, body })
  if (body.mode === 'retry_correct_log') return handleRetryCorrectLog({ userId, body })
  return handleCorrectWorkSubmission({ userId, body })
}

export default createStudentHandler({ method: 'POST', validate, handle })
