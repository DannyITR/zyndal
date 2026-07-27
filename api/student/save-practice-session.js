import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getStreakRow } from '../_lib/db.js'
import { COINS_PER_CORRECT } from '../../src/lib/streak.js'

// Backs savePracticeSession() in src/lib/storage.js. score_percentage and
// coins_earned are NOT accepted from the client and are computed here from
// questions_correct/questions_total instead — Practice questions are
// AI-generated or drawn from a student's own uploads (unlike the daily
// question, there's no static server-side answer key to check selections
// against; see submit-answer.js's header comment for that contrast), so the
// server can't independently verify which answers were actually correct.
// What it CAN do is stop trusting a client-supplied coin count outright: the
// old design called awardCoins(userId, 1) directly from the browser on every
// correct first attempt (see PracticeSessionScreen.jsx pre-Session-5), which
// let a malicious client credit itself arbitrary coins with no session at
// all ever being completed. Bundling the award into this one authoritative
// end-of-session write, derived from the same questions_correct count the
// session summary itself is built from, closes that off — coins earned here
// always match the session actually recorded, even though "was this
// specific answer correct" still ultimately traces back to client-reported
// state, same as it always has for AI-sourced content.
function validate(body) {
  if (!body.subject || typeof body.subject !== 'string') return 'subject is required.'
  if (!body.topic || typeof body.topic !== 'string') return 'topic is required.'
  if (!Number.isInteger(body.questions_total) || body.questions_total <= 0) return 'questions_total must be a positive integer.'
  if (!Number.isInteger(body.questions_correct) || body.questions_correct < 0 || body.questions_correct > body.questions_total) {
    return 'questions_correct must be an integer between 0 and questions_total.'
  }
  return null
}

async function handle({ userId, body }) {
  const { subject, topic, questions_correct: questionsCorrect, questions_total: questionsTotal } = body
  const scorePercentage = Math.round((questionsCorrect / questionsTotal) * 100)
  const coinsEarned = questionsCorrect * COINS_PER_CORRECT

  const { data: session, error } = await supabase
    .from('practice_sessions')
    .insert({
      user_id: userId,
      subject,
      topic,
      score_percentage: scorePercentage,
      questions_correct: questionsCorrect,
      questions_total: questionsTotal,
      coins_earned: coinsEarned,
    })
    .select()
    .single()
  if (error) throw error

  if (coinsEarned > 0) {
    const streakRow = await getStreakRow(userId)
    const { error: coinError } = await supabase
      .from('streaks')
      .update({ coin_balance: streakRow.coin_balance + coinsEarned })
      .eq('user_id', userId)
    if (coinError) throw coinError
  }

  return session
}

export default createStudentHandler({ method: 'POST', validate, handle })
