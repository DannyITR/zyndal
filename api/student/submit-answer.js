import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getProgressForUser, getLinkedParents, normalizeMilestoneBonuses, recordPerfectWeekAchievement, syncUserTimezone } from '../_lib/db.js'
import { resolveDailyQuestion } from '../_lib/dailyQuestion.js'
import { applyDailyAnswer, getWeeklyCorrectCount, PERFECT_WEEK_TARGET, todayStr, isValidTimeZone, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'
import { SUBJECTS, getTodaysSubjectId } from '../../src/lib/questions.js'
import { insertNotification } from '../_lib/notifications.js'
import { notificationText } from '../_lib/notificationText.js'
import { sendPushToUser } from '../_lib/push.js'
import { centsToDisplay } from '../../src/lib/money.js'

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
// the client used to run locally — resolveDailyQuestion (api/_lib/
// dailyQuestion.js) is the same resolver api/questions/get-daily-question.js
// uses for display, so both always agree on which question "today's" is.
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

  // Only one subject rotates in per day, same for every student (see
  // getTodaysSubjectId) — reject anything else server-side too, not just by
  // never offering it in the UI.
  if (subject !== getTodaysSubjectId(today)) {
    const err = new Error("That subject isn't today's rotated subject.")
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  const question = await resolveDailyQuestion({ userId, subject, timezone })

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

  const linkedParents = await getLinkedParents(userId)
  // Milestone bonuses are a single shared coin grant to the student, not a
  // per-parent suggestion like perfect-week/grade bonuses below — with up
  // to 2 linked parents potentially having different milestone_settings,
  // there's no sane way to apply both to one grant, so this uses whichever
  // parent linked first.
  const milestoneBonuses = normalizeMilestoneBonuses(linkedParents[0]?.milestoneSettings)
  // Day-streak rule: applyDailyAnswer credits the streak the moment the
  // FIRST correct first-attempt answer of the day lands, in any single
  // subject — it no longer requires all 6. Nothing else here needs to
  // change for that: coins/XP already accrue per correct answer regardless
  // of subject count, and getEffectiveStreak's gap-based reset (see
  // api/student/get-streak.js) is driven purely by lastCorrectDate vs
  // today, agnostic to how it got set.
  const result = applyDailyAnswer(progress, question, selected_index, subject, today, milestoneBonuses)

  // .select().single() (rather than a bare insert) so the new row's id can
  // be handed back to the client as answer_id — grade-work.js needs it to
  // look up this exact answer server-side for the Math scratchpad bonus.
  const { data: insertedAnswer, error: answerError } = await supabase
    .from('answers')
    .insert({
      user_id: userId,
      subject,
      question_text: question.prompt,
      selected_answer: question.options[selected_index],
      correct: result.correct,
    })
    .select('id')
    .single()
  if (answerError) throw answerError

  // Non-critical (backs the admin panel's Last Active column) — never block
  // the answer submission over it.
  const { error: lastActivityError } = await supabase.from('users').update({ last_activity_at: new Date().toISOString() }).eq('id', userId)
  if (lastActivityError) console.error('[api] failed to update last_activity_at:', lastActivityError)

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

  // Client-facing celebration only ever shows one number — see
  // StudentHome.jsx's handleSelect — so with up to 2 linked parents
  // potentially suggesting different amounts, this surfaces the first
  // linked parent's amount specifically (matches the milestoneBonuses
  // choice above). Both parents still each get their own row + own
  // notification below, regardless of which amount is shown here.
  let perfectWeekBonusCents = null
  if (result.correct && linkedParents.length > 0) {
    const weeklyCount = getWeeklyCorrectCount(result.progress.history, today)
    if (weeklyCount === PERFECT_WEEK_TARGET) {
      const { data: student } = await supabase.from('users').select('username').eq('id', userId).maybeSingle()
      const studentUsername = student?.username || 'Someone'
      for (const parent of linkedParents) {
        const achievement = await recordPerfectWeekAchievement(userId, parent.parentId, parent.perfectWeekBonusDollars, today)
        if (!achievement) continue
        if (perfectWeekBonusCents === null) perfectWeekBonusCents = achievement.suggested_bonus_cents
        const amount = centsToDisplay(achievement.suggested_bonus_cents)
        const { title, body: notifBody } = notificationText('perfect_week_ready', parent.languagePreference, { studentUsername, amount })
        await insertNotification({ userId: parent.parentId, type: 'perfect_week_ready', title, body: notifBody, data: { student_id: userId } })
        await sendPushToUser({ userId: parent.parentId, type: 'perfect_week_ready', title, body: notifBody, url: 'https://zyndal.ca' })
      }
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
    answer_id: insertedAnswer.id,
  }
}

export default createStudentHandler({ method: 'POST', validate, handle })
