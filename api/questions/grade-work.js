import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeImageBase64 } from '../_lib/sanitize.js'
import { generateJson } from '../_lib/anthropic.js'

// Scratchpad is Math-only — other subjects may be added in future.

const MAX_ATTEMPTS_PER_ANSWER = 2

const GRADE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    approved: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['approved', 'reason'],
}

function validate(body) {
  const answerId = sanitizeUuid(body.answer_id)
  if (!answerId) return { field: 'answer_id', message: 'A valid answer_id is required.' }
  body.answer_id = answerId

  const image = sanitizeImageBase64(body.image_base64)
  if (!image) return { field: 'image_base64', message: 'image_base64 is required.' }
  body.image_base64 = image

  return null
}

// Deliberately NOT the { image_base64, question_text, correct_answer }
// request shape as originally specified — a client-supplied question_text/
// correct_answer would let anyone forge a matching pair via curl and farm
// the bonus regardless of what they actually answered. Instead the client
// sends only answer_id (from submit-answer.js's response) and the server
// looks up that row itself: question_text and the correct answer text both
// come from the already-scored `answers` row, mirroring submit-answer.js's
// own "never trust client-reported correctness" convention.
async function handle({ userId, body }) {
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

  const { data: priorSubmissions, error: priorError } = await supabase
    .from('work_submissions')
    .select('id, approved')
    .eq('answer_id', answer_id)
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
  })
  if (insertError) throw insertError

  if (approved) {
    const { data: streakRow, error: streakFetchError } = await supabase.from('streaks').select('total_xp, coin_balance').eq('user_id', userId).maybeSingle()
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

export default createStudentHandler({ method: 'POST', validate, handle })
