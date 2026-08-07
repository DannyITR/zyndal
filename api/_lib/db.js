// Server-side mirrors of a few PRIVATE (non-exported) helpers in
// src/lib/storage.js — that file can't be imported directly here because it
// pulls in supabaseClient.js, which references `localStorage` and doesn't
// exist in a Node.js serverless environment. The pure logic (no browser
// dependencies) still comes straight from src/lib/streak.js and
// src/lib/questions.js via relative import, so the actual game-logic
// algorithm stays byte-identical between client and server — only the
// Supabase I/O glue is duplicated here.
import { supabase } from './auth.js'
import {
  DEFAULT_MILESTONE_BONUSES,
  PERFECT_WEEK_TARGET,
  TOTAL_SUBJECTS,
  mondayOfWeek,
  todayStr,
  countCorrectSubjectsToday,
  computeDayState,
  getEffectiveStreak,
} from '../../src/lib/streak.js'
import { findQuestionByPrompt } from '../../src/lib/questions.js'

// Every column a user is allowed to see on their OWN row — everything
// except password. Shared by get-profile.js and the Session 5 auth
// endpoints (login/signup return the same shape get-profile.js does, so the
// client's `user` object looks identical regardless of which call produced it).
// subscription_plan/subscription_current_period_end/is_subscription_owner
// are display-safe Stripe-derived fields (Settings' "Premium — renews
// [date]" and Manage-subscription visibility) — stripe_customer_id/
// stripe_subscription_id are deliberately NOT in this list and must never
// be added to it; raw Stripe IDs are never shown to users.
export const SAFE_USER_COLUMNS =
  'id, username, account_type, grade, parent_code, created_at, display_name, email, school, avatar, wallet_balance_cents, total_added_cents, total_paid_out_cents, coin_to_dollar_rate, milestone_settings, is_premium, language_preference, email_verified, notification_preferences, trial_started_at, trial_ends_at, is_paying_subscriber, subscription_plan, subscription_current_period_end, is_subscription_owner'

// Deliberately duplicated from the local (unexported) generateUniqueParentCode
// in api/auth/signup.js rather than importing it from there — signup.js is
// off-limits to changes (see api/auth/oauth-callback.js), so this is the
// shared home for any other endpoint (currently just
// api/student/update-settings.js, for a student->parent OAuth-onboarding
// conversion) that also needs to mint a parent code. Keep the two in sync by
// hand if this logic ever changes.
const PARENT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I

function randomParentCode(length = 6) {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += PARENT_CODE_ALPHABET[Math.floor(Math.random() * PARENT_CODE_ALPHABET.length)]
  }
  return code
}

export async function generateUniqueParentCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomParentCode()
    const { data, error } = await supabase.from('users').select('id').eq('parent_code', code).maybeSingle()
    if (error) throw error
    if (!data) return code
  }
  const err = new Error('Could not generate a unique parent code. Please try again.')
  err.status = 500
  err.code = 'SERVER_ERROR'
  throw err
}

// Same alphabet/length/retry pattern as generateUniqueParentCode above,
// checked against classes.teacher_code instead of users.parent_code —
// used only by api/teacher/create-class.js.
export async function generateUniqueTeacherCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomParentCode()
    const { data, error } = await supabase.from('classes').select('id').eq('teacher_code', code).maybeSingle()
    if (error) throw error
    if (!data) return code
  }
  const err = new Error('Could not generate a unique class code. Please try again.')
  err.status = 500
  err.code = 'SERVER_ERROR'
  throw err
}

// Best-effort — a failed write here only matters if a future request
// somehow arrives with no timezone at all (falls back to
// users.timezone's own default, 'America/Toronto', in that case), so this
// never throws. The .neq filter turns a no-op call (the stored value
// already matches) into zero rows updated instead of a wasted write, since
// this runs on every submit-answer/get-daily-progress/get-streak call.
export async function syncUserTimezone(userId, timezone) {
  const { error } = await supabase.from('users').update({ timezone }).eq('id', userId).neq('timezone', timezone)
  if (error) console.error('[db] failed to sync user timezone:', error)
}

export async function getStreakRow(userId) {
  const { data, error } = await supabase.from('streaks').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (data) return data

  const { data: created, error: insertError } = await supabase.from('streaks').insert({ user_id: userId }).select().single()
  if (insertError) throw insertError
  return created
}

// A stored answer's question_text might match a generated_questions row
// instead of the hardcoded bank (findQuestionByPrompt only ever searches
// the latter) — this batch-fetches every generated question for the
// subjects actually present in a set of answer rows, keyed by its own
// question text, so rowToEntry can fall back to it. Wrapped defensively:
// the generated_questions table is a new addition the operator runs via a
// separate SQL migration, so a request landing before that migration has
// run must not break every progress-related endpoint — treat a missing
// table (or any other lookup failure) as "no generated questions yet"
// rather than throwing.
async function buildGeneratedQuestionsMap(answerRows) {
  const subjects = [...new Set(answerRows.map((r) => r.subject))]
  if (subjects.length === 0) return new Map()
  try {
    const { data, error } = await supabase.from('generated_questions').select('question, options, correct').in('subject', subjects)
    if (error) throw error
    return new Map((data || []).map((row) => [row.question, row]))
  } catch (err) {
    console.error('[db] failed to load generated_questions for history lookup:', err)
    return new Map()
  }
}

// Mirrors rowToEntry in storage.js exactly, plus timezone-aware date
// bucketing (storage.js's version predates the timezone feature and isn't
// used for any date comparison itself — see its own comment).
//
// Bug fix: this used to always do row.answered_at.slice(0, 10) — a raw UTC
// slice of the stored timestamp, completely ignoring timezone. That made
// "today" comparisons downstream (get-daily-progress.js's grid state,
// submit-answer.js's dedup check, get-progress.js's per-subject "already
// answered" lookup) wrong for any answer submitted late at night local
// time, since its UTC calendar date can already be "tomorrow" — e.g. 11pm
// Toronto is 3/4am UTC the next day. An answer from last night could then
// still read as "today" for the rest of that UTC day. Every current caller
// now passes a timezone (see getProgressForUser below); the undefined
// fallback exists only as a defensive default, not because anything
// intentionally omits one.
//
// generatedByText (Map<questionText, {options, correct}>, optional) is the
// second lookup source for a generated-pool question — see
// buildGeneratedQuestionsMap above. Checked only when findQuestionByPrompt
// (the hardcoded bank) comes back empty, so a stored answer's question can
// come from either source and still render correctly everywhere history is
// shown (streak calc, Day Review, share cards).
function rowToEntry(row, timezone, generatedByText) {
  let match = findQuestionByPrompt(row.subject, row.question_text)
  if (!match && generatedByText) {
    const generated = generatedByText.get(row.question_text)
    if (generated) match = { options: generated.options, correctIndex: generated.correct }
  }
  const selectedIndex = match ? match.options.indexOf(row.selected_answer) : -1
  return {
    id: row.id,
    date: timezone ? todayStr(new Date(row.answered_at), timezone) : row.answered_at.slice(0, 10),
    subjectId: row.subject,
    prompt: row.question_text,
    correct: row.correct,
    correctIndex: match?.correctIndex,
    options: match?.options,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
    selectedAnswer: row.selected_answer,
    correctAnswer: match ? match.options[match.correctIndex] : null,
    xpEarned: row.correct ? 1 : 0,
    coinsEarned: row.correct ? 1 : 0,
  }
}

// Mirrors toProgress + getProgress in storage.js exactly.
export function toProgress(streakRow, answerRows, timezone, generatedByText) {
  return {
    studentId: streakRow.user_id,
    streak: streakRow.current_streak,
    longestStreak: streakRow.longest_streak,
    xp: streakRow.total_xp,
    coins: streakRow.coin_balance,
    lastCorrectDate: streakRow.last_answered_date,
    history: answerRows.map((row) => rowToEntry(row, timezone, generatedByText)),
  }
}

export async function getProgressForUser(userId, timezone) {
  const streakRow = await getStreakRow(userId)
  const { data: answerRows, error } = await supabase
    .from('answers')
    .select('*')
    .eq('user_id', userId)
    .order('answered_at', { ascending: true })
  if (error) throw error
  const generatedByText = await buildGeneratedQuestionsMap(answerRows || [])
  return toProgress(streakRow, answerRows || [], timezone, generatedByText)
}

// Used by api/social/share-score.js (its response + the score_share
// notification body) and api/social/get-incoming-shares.js (per-sender,
// batched) — "today's" correct-answer count out of TOTAL_SUBJECTS, in the
// caller's own timezone.
export async function getTodayScore(userId, timezone) {
  const progress = await getProgressForUser(userId, timezone)
  const today = todayStr(new Date(), timezone)
  return { correct: countCorrectSubjectsToday(progress.history, today), total: TOTAL_SUBJECTS }
}

// Used by api/social/share-score.js to gate sharing on subjects ATTEMPTED
// today (correct or incorrect), not just correct ones — matches
// computeDailyState in api/student/get-daily-progress.js (which drives the
// subject grid's green/red states) and StudentFlow.jsx's own canShareToday
// computation for the Friends screen. A subject counts as "done for the
// day" the moment it's answered at all; getTodayScore above stays
// correct-only since it's also used for score DISPLAY (the share card's
// "X/6", the score_share notification body), a separate concept from
// share eligibility.
export async function getTodayAttemptedCount(userId, timezone) {
  const progress = await getProgressForUser(userId, timezone)
  const today = todayStr(new Date(), timezone)
  const { completedIds, incorrectIds } = computeDayState(progress.history, today)
  return completedIds.size + incorrectIds.size
}

// Used by api/_lib/dailyQuestion.js's resolveDailyQuestion to read the
// student's own grade and language_preference in one query — no existing
// helper does a plain "get user by id" lookup, so this follows the same
// targeted-query style as getLinkedParents below rather than pulling in the
// full SAFE_USER_COLUMNS set.
export async function getUserGradeAndLanguage(userId) {
  const { data, error } = await supabase.from('users').select('grade, language_preference').eq('id', userId).maybeSingle()
  if (error) throw error
  return { grade: data?.grade ?? null, languagePreference: data?.language_preference ?? null }
}

// This month's answered question texts for a subject, in the given
// timezone — used by resolveDailyQuestion to skip a pool question the
// student already answered this month. Scoped by a UTC-range query on
// answered_at rather than a client-side date-string filter (matching how
// get-daily-question.js's existing "already answered today" check already
// queries answers directly), since this only needs question_text/date, not
// the full progress-history reconstruction getProgressForUser does.
export async function getAnswersThisMonth(userId, subject, timezone) {
  const monthStart = todayStr(new Date(), timezone).slice(0, 7) + '-01'
  const { data, error } = await supabase
    .from('answers')
    .select('question_text')
    .eq('user_id', userId)
    .eq('subject', subject)
    .gte('answered_at', `${monthStart}T00:00:00.000Z`)
  if (error) throw error
  return new Set((data || []).map((row) => row.question_text))
}

// Returns an array (0-2 entries — a student can have up to 2 linked
// parents) instead of a single object/null, since each linked parent has
// their own independent reward settings (perfect_week_bonus, grade reward
// thresholds, milestone_settings). Callers that create a per-parent
// suggested-bonus row (submit-answer.js, save-upload.js, create-grade.js)
// loop over this; perfect_week_achievements/grade_bonuses' unique
// constraints were widened to include parent_id specifically so one row
// per linked parent no longer collides.
export async function getLinkedParents(studentId) {
  const { data: links, error: linkError } = await supabase
    .from('parent_student')
    .select(
      'parent_id, perfect_week_bonus, grade_reward_a_plus_cents, grade_reward_a_cents, grade_reward_b_cents, grade_reward_c_cents'
    )
    .eq('student_id', studentId)
  if (linkError) throw linkError
  if (!links || links.length === 0) return []

  const parentIds = links.map((l) => l.parent_id)
  const { data: parents, error: parentError } = await supabase
    .from('users')
    .select('id, milestone_settings, language_preference')
    .in('id', parentIds)
  if (parentError) throw parentError
  const parentById = Object.fromEntries((parents || []).map((p) => [p.id, p]))

  return links.map((link) => ({
    parentId: link.parent_id,
    perfectWeekBonusDollars: Number(link.perfect_week_bonus ?? 10),
    milestoneSettings: parentById[link.parent_id]?.milestone_settings ?? null,
    languagePreference: parentById[link.parent_id]?.language_preference ?? null,
    gradeRewardAPlusCents: link.grade_reward_a_plus_cents ?? 2500,
    gradeRewardACents: link.grade_reward_a_cents ?? 1500,
    gradeRewardBCents: link.grade_reward_b_cents ?? 1000,
    gradeRewardCCents: link.grade_reward_c_cents ?? 500,
  }))
}

// For a student's home screen: whether they have a linked parent at all
// (drives the Coins stat box / Wallet page's visibility — see
// StudentFlow.jsx and api/student/get-wallet.js) and, if so, whether ANY
// linked parent (up to 2) has deleted their own account (drives the
// one-time "your parent account was deactivated" banner in
// StudentFlow.jsx). parentDeleted fires on ANY linked parent's deletion,
// not only once zero remain — a student who still has one active parent
// left but just lost the other is still losing a benefactor, and staying
// silent would be a worse gap than one extra banner. Combined into one
// function since both need the same parent_student lookup — get-profile.js
// used to run this as two separate queries across two call sites before the
// Wallet feature needed the "linked at all" half too.
export async function getLinkedParentStatus(studentId) {
  const { data: links, error: linkError } = await supabase.from('parent_student').select('parent_id').eq('student_id', studentId)
  if (linkError) throw linkError
  if (!links || links.length === 0) return { linked: false, parentDeleted: false }

  const parentIds = links.map((l) => l.parent_id)
  const { data: parents, error: parentError } = await supabase.from('users').select('deleted_at').in('id', parentIds)
  if (parentError) throw parentError
  return { linked: true, parentDeleted: (parents || []).some((p) => Boolean(p.deleted_at)) }
}

// Mirrors normalizeMilestoneBonuses in storage.js exactly.
export function normalizeMilestoneBonuses(milestoneSettings) {
  if (!milestoneSettings) return DEFAULT_MILESTONE_BONUSES
  const normalized = {}
  for (const [day, bonus] of Object.entries(milestoneSettings)) {
    normalized[Number(day)] = Number(bonus)
  }
  return normalized
}

// Mirrors recordPerfectWeekAchievement in storage.js exactly.
export async function recordPerfectWeekAchievement(studentId, parentId, perfectWeekBonusDollars, today) {
  const weekStart = mondayOfWeek(today)
  const suggestedBonusCents = Math.round(perfectWeekBonusDollars * 100)

  const { data, error } = await supabase
    .from('perfect_week_achievements')
    .insert({
      student_id: studentId,
      parent_id: parentId,
      week_start: weekStart,
      correct_count: PERFECT_WEEK_TARGET,
      suggested_bonus_cents: suggestedBonusCents,
    })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return null // already recorded this week
    throw error
  }
  return data
}

// Shared by api/social/get-leaderboard.js (global/friends) and
// api/teacher/get-leaderboard.js (global/per-class) — same ranked-by-XP
// query either way, just scoped to a different userIds set (or none, for
// the unscoped global board). Deleted accounts and non-student rows (a
// teacher's or parent's own streaks row, if one exists) are filtered out
// here so neither caller has to repeat that logic.
export async function fetchLeaderboardRows(userIds) {
  let query = supabase
    .from('streaks')
    .select('current_streak, total_xp, last_answered_date, user_id, users:user_id(username, grade, account_type, deleted_at)')
    .order('total_xp', { ascending: false })
  if (userIds) query = query.in('user_id', userIds)

  const { data, error } = await query
  if (error) throw error

  const today = todayStr()
  return (data || [])
    .filter((row) => row.users?.account_type === 'student' && !row.users?.deleted_at)
    .map((row) => ({
      userId: row.user_id,
      username: row.users.username,
      grade: row.users.grade,
      xp: row.total_xp,
      streak: getEffectiveStreak({ streak: row.current_streak, lastCorrectDate: row.last_answered_date }, today),
    }))
}
