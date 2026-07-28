import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getProgressForUser, getLinkedParent, normalizeMilestoneBonuses, recordPerfectWeekAchievement, syncUserTimezone } from '../_lib/db.js'
import { applyDailyAnswer, getWeeklyCorrectCount, PERFECT_WEEK_TARGET, todayStr, isValidTimeZone, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'
import { getDailyQuestion, SUBJECTS } from '../../src/lib/questions.js'

// Deliberately NOT the request shape originally specified
// ({ subject, question_text, selected_answer, correct, is_first_attempt }).
// That shape would have the client self-report whether its answer was
// correct — trivial to forge (e.g. via curl) into free XP/coins/streak
// credit, and "first attempt" was never a concept the server needs to be
// told: today's app only ever calls this once per subject per day (retries
// are handled entirely client-side and never reach here — see
// StudentHome.jsx's handleSelect). Instead this mirrors the actual current
// architecture (submitAnswer in src/lib/storage.js): the client sends only
// { subject, selected_index }, and the server looks up today's question and
// determines correctness itself using the exact same applyDailyAnswer logic
// the client used to run locally — see api/_lib/db.js's header comment for
// why that's imported directly rather than duplicated.
function validate(body) {
  if (!body.subject || !SUBJECTS.some((s) => s.id === body.subject)) return 'subject is required and must be a valid subject id.'
  if (!Number.isInteger(body.selected_index) || body.selected_index < 0) return 'selected_index is required and must be a non-negative integer.'
  return null
}

async function handle({ userId, body }) {
  const { subject, selected_index } = body
  // The client detects its own zone (Intl.DateTimeFormat, see
  // src/lib/timezone.js) and sends it with every answer submission — the
  // server has no way to know a browser's local timezone on its own.
  // Falls back to America/Toronto (matches users.timezone's column
  // default) for a missing/invalid value rather than UTC, since that's the
  // closer default for this app's actual user base.
  const timezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE
  const today = todayStr(new Date(), timezone)
  await syncUserTimezone(userId, timezone)

  const question = getDailyQuestion(subject)
  if (!question) {
    const err = new Error('Unknown subject.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  const progress = await getProgressForUser(userId, timezone)

  // Same one-answer-per-subject-per-day rule the client already enforces by
  // never calling this a second time — enforced here too since the server
  // is now the actual source of truth.
  const alreadyAnsweredToday = progress.history.some((h) => h.date === today && h.subjectId === subject)
  if (alreadyAnsweredToday) {
    const err = new Error("Today's question for this subject has already been answered.")
    err.status = 409
    err.code = 'ALREADY_ANSWERED'
    throw err
  }

  const linkedParent = await getLinkedParent(userId)
  const milestoneBonuses = normalizeMilestoneBonuses(linkedParent?.milestoneSettings)
  const result = applyDailyAnswer(progress, question, selected_index, subject, today, milestoneBonuses)

  const { error: answerError } = await supabase.from('answers').insert({
    user_id: userId,
    subject,
    question_text: question.prompt,
    selected_answer: question.options[selected_index],
    correct: result.correct,
  })
  if (answerError) throw answerError

  const { error: streakError } = await supabase
    .from('streaks')
    .update({
      current_streak: result.progress.streak,
      longest_streak: result.progress.longestStreak,
      total_xp: result.progress.xp,
      coin_balance: result.progress.coins,
      last_answered_date: result.progress.lastCorrectDate,
    })
    .eq('user_id', userId)
  if (streakError) throw streakError

  let perfectWeekBonusCents = null
  if (result.correct && linkedParent) {
    const weeklyCount = getWeeklyCorrectCount(result.progress.history, today)
    if (weeklyCount === PERFECT_WEEK_TARGET) {
      const achievement = await recordPerfectWeekAchievement(userId, linkedParent.parentId, linkedParent.perfectWeekBonusDollars, today)
      if (achievement) perfectWeekBonusCents = achievement.suggested_bonus_cents
    }
  }

  const newEntry = result.progress.history[result.progress.history.length - 1]

  return {
    correct: result.correct,
    xp_earned: result.xpEarned,
    coins_earned: result.coinsEarned,
    new_streak: result.progress.streak,
    longest_streak: result.progress.longestStreak,
    new_xp_total: result.progress.xp,
    new_coins_total: result.progress.coins,
    last_correct_date: result.progress.lastCorrectDate,
    milestone_reached: result.milestoneHit,
    bonus_earned: result.bonusEarned,
    perfect_week_bonus_cents: perfectWeekBonusCents,
    entry: newEntry,
  }
}

export default createStudentHandler({ method: 'POST', validate, handle })
