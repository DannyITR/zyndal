import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getProgressForUser, getStreakRow, syncUserTimezone } from '../_lib/db.js'
import {
  todayStr,
  isValidTimeZone,
  DEFAULT_TIMEZONE,
  localNoonUtc,
  diffDays,
  XP_PER_CORRECT,
  COINS_PER_CORRECT,
  LATE_ANSWER_WINDOW_DAYS,
} from '../../src/lib/streak.js'
import { getDailyQuestion, SUBJECTS } from '../../src/lib/questions.js'

// Backs the home screen's date-nav bar → past date → "Answer now" flow
// (StudentHome.jsx) — catching up on a subject that was never answered on a
// PAST day. It never touches the streaks table's streak/lastCorrectDate
// fields at all, so a late answer can never retroactively create or extend
// a streak, regardless of how recent it is.
//
// XP/coins are gated on a 3-day window, computed server-side from `date` vs
// today (in the student's own timezone) — never trust the client for this:
// within 3 days (yesterday, 2, or 3 days ago), a correct answer earns full
// XP and coins, same amount as the regular daily flow; older than that,
// answering is still allowed (for practice) but earns nothing.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function validate(body) {
  if (!body.subject || !SUBJECTS.some((s) => s.id === body.subject)) return 'subject is required and must be a valid subject id.'
  if (!Number.isInteger(body.selected_index) || body.selected_index < 0) return 'selected_index is required and must be a non-negative integer.'
  if (!body.date || typeof body.date !== 'string' || !DATE_PATTERN.test(body.date)) return 'date is required and must be an ISO date (YYYY-MM-DD).'
  return null
}

async function handle({ userId, body }) {
  const { subject, selected_index: selectedIndex, date } = body
  const timezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE
  const today = todayStr(new Date(), timezone)
  await syncUserTimezone(userId, timezone)

  if (date >= today) {
    const err = new Error('date must be a past day — use the regular daily question endpoint for today.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  // Same date-seeded rotation the live daily question uses (see
  // src/lib/questions.js) — noon UTC on the target date keeps this on the
  // correct UTC calendar day for the rotation's own day-index math, which
  // (like the rest of the app before the timezone fixes) is UTC-based.
  const question = getDailyQuestion(subject, new Date(`${date}T12:00:00Z`))
  if (!question) {
    const err = new Error('Unknown subject.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  const progress = await getProgressForUser(userId, timezone)
  const alreadyAnswered = progress.history.some((h) => h.date === date && h.subjectId === subject)
  if (alreadyAnswered) {
    const err = new Error('This subject has already been answered for that day.')
    err.status = 409
    err.code = 'ALREADY_ANSWERED'
    throw err
  }

  const correct = selectedIndex === question.correctIndex
  const withinLateWindow = diffDays(today, date) <= LATE_ANSWER_WINDOW_DAYS
  const xpEarned = correct && withinLateWindow ? XP_PER_CORRECT : 0
  const coinsEarned = correct && withinLateWindow ? COINS_PER_CORRECT : 0
  const answeredAt = localNoonUtc(date, timezone).toISOString()

  const { error: answerError } = await supabase.from('answers').insert({
    user_id: userId,
    subject,
    question_text: question.prompt,
    selected_answer: question.options[selectedIndex],
    correct,
    answered_at: answeredAt,
  })
  if (answerError) throw answerError

  if (xpEarned > 0 || coinsEarned > 0) {
    const streakRow = await getStreakRow(userId)
    const { error: rewardError } = await supabase
      .from('streaks')
      .update({ total_xp: streakRow.total_xp + xpEarned, coin_balance: streakRow.coin_balance + coinsEarned })
      .eq('user_id', userId)
    if (rewardError) throw rewardError
  }

  return {
    correct,
    xp_earned: xpEarned,
    coins_earned: coinsEarned,
    within_late_window: withinLateWindow,
    entry: {
      date,
      subjectId: subject,
      questionId: question.id,
      prompt: question.prompt,
      options: question.options,
      selectedIndex,
      correctIndex: question.correctIndex,
      selectedAnswer: question.options[selectedIndex],
      correctAnswer: question.options[question.correctIndex],
      correct,
      xpEarned,
      coinsEarned,
    },
  }
}

export default createStudentHandler({ method: 'POST', validate, handle })
