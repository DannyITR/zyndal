import { supabase } from './supabaseClient'
import {
  XP_PER_CORRECT,
  COINS_PER_CORRECT,
  DEFAULT_MILESTONE_BONUSES,
  PERFECT_WEEK_TARGET,
  applyDailyAnswer,
  getEffectiveStreak,
  getWeeklyCorrectCount,
  mondayOfWeek,
  todayStr,
} from './streak'
import { centsToCoins } from './money'
import { findQuestionByPrompt } from './questions'
import { computeSuggestedBonusCents } from './gradeReward'

const SESSION_KEY = 'zyndal_session'

// ---------- Session ----------
// localStorage is only ever used as a cache of which user id is currently
// logged in on this device — every other piece of data lives in Supabase.

export function getSessionUserId() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw).userId : null
  } catch {
    return null
  }
}

export function setSession(userId) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId }))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

// ---------- Users ----------

export async function findUserByUsername(username) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('username', username.trim())
    .maybeSingle()
  if (error) throw error
  return data
}

export async function findUserById(id) {
  if (!id) return null
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function findUserByParentCode(code) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('account_type', 'parent')
    .eq('parent_code', code.trim().toUpperCase())
    .maybeSingle()
  if (error) throw error
  return data
}

// accountType: 'student' | 'parent'; grade and parentCode are nullable.
export async function createUser({ username, password, accountType, grade = null, parentCode = null }) {
  const { data, error } = await supabase
    .from('users')
    .insert({ username, password, account_type: accountType, grade, parent_code: parentCode })
    .select()
    .single()
  if (error) throw error

  if (accountType === 'student') {
    const { error: streakError } = await supabase.from('streaks').insert({ user_id: data.id })
    if (streakError) throw streakError
  }

  return data
}

// grade is only meaningful for students; pass the existing value through for parents.
export async function updateUserProfile(userId, { displayName, email, schoolName, avatar, grade }) {
  const { data, error } = await supabase
    .from('users')
    .update({
      display_name: displayName || null,
      email: email || null,
      school: schoolName || null,
      avatar: avatar || null,
      grade,
    })
    .eq('id', userId)
    .select()
    .single()
  if (error) {
    console.error('[storage] updateUserProfile failed:', error)
    throw error
  }
  return data
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await findUserById(userId)
  if (!user || user.password !== currentPassword) {
    throw new Error('Current password is incorrect.')
  }
  const { error } = await supabase.from('users').update({ password: newPassword }).eq('id', userId)
  if (error) {
    console.error('[storage] changePassword failed:', error)
    throw error
  }
}

export async function getCurrentUser() {
  const userId = getSessionUserId()
  if (!userId) return null
  try {
    const user = await findUserById(userId)
    if (!user) clearSession()
    return user
  } catch {
    // Stale or invalid session (e.g. leftover from before this device's
    // localStorage was pointed at Supabase) — treat it as logged out.
    clearSession()
    return null
  }
}

// ---------- Parent <-> student links ----------

export async function linkParentAndStudent(parentId, studentId) {
  const { error } = await supabase.from('parent_student').insert({ parent_id: parentId, student_id: studentId })
  if (error) throw error
}

export async function getStudentsForParent(parentId) {
  const { data: links, error: linkError } = await supabase
    .from('parent_student')
    .select(
      'student_id, perfect_week_bonus, grade_reward_a_plus_cents, grade_reward_a_cents, grade_reward_b_cents, grade_reward_c_cents'
    )
    .eq('parent_id', parentId)
  if (linkError) throw linkError

  const studentIds = (links || []).map((link) => link.student_id)
  if (studentIds.length === 0) return []

  const { data: students, error } = await supabase.from('users').select('*').in('id', studentIds)
  if (error) throw error

  const linkByStudentId = Object.fromEntries((links || []).map((l) => [l.student_id, l]))
  return (students || []).map((s) => {
    const link = linkByStudentId[s.id] || {}
    return {
      ...s,
      perfectWeekBonus: Number(link.perfect_week_bonus ?? 10),
      gradeRewardAPlusCents: link.grade_reward_a_plus_cents ?? 2500,
      gradeRewardACents: link.grade_reward_a_cents ?? 1500,
      gradeRewardBCents: link.grade_reward_b_cents ?? 1000,
      gradeRewardCCents: link.grade_reward_c_cents ?? 500,
    }
  })
}

export async function updatePerfectWeekBonus(parentId, studentId, amountDollars) {
  const { error } = await supabase
    .from('parent_student')
    .update({ perfect_week_bonus: amountDollars })
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
  if (error) throw error
}

export async function updateGradeRewardSettings(parentId, studentId, { aPlusCents, aCents, bCents, cCents }) {
  const { error } = await supabase
    .from('parent_student')
    .update({
      grade_reward_a_plus_cents: aPlusCents,
      grade_reward_a_cents: aCents,
      grade_reward_b_cents: bCents,
      grade_reward_c_cents: cCents,
    })
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
  if (error) throw error
}

// ---------- Streaks & answers ----------

async function getStreakRow(userId) {
  const { data, error } = await supabase.from('streaks').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (data) return data

  const { data: created, error: insertError } = await supabase
    .from('streaks')
    .insert({ user_id: userId })
    .select()
    .single()
  if (insertError) throw insertError
  return created
}

// The answers table stores the selected option's text directly, but not the
// full option list or which index it was, so those are reconstructed here by
// matching the static question bank on prompt text.
function rowToEntry(row) {
  const match = findQuestionByPrompt(row.subject, row.question_text)
  const selectedIndex = match ? match.options.indexOf(row.selected_answer) : -1
  return {
    id: row.id,
    date: row.answered_at.slice(0, 10),
    subjectId: row.subject,
    prompt: row.question_text,
    correct: row.correct,
    correctIndex: match?.correctIndex,
    options: match?.options,
    selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
    selectedAnswer: row.selected_answer,
    correctAnswer: match ? match.options[match.correctIndex] : null,
    xpEarned: row.correct ? XP_PER_CORRECT : 0,
    coinsEarned: row.correct ? COINS_PER_CORRECT : 0,
  }
}

function toProgress(streakRow, answerRows) {
  return {
    studentId: streakRow.user_id,
    streak: streakRow.current_streak,
    longestStreak: streakRow.longest_streak,
    xp: streakRow.total_xp,
    coins: streakRow.coin_balance,
    // Reused as "date the streak was last credited" (i.e. last correct answer).
    lastCorrectDate: streakRow.last_answered_date,
    history: answerRows.map(rowToEntry),
  }
}

export async function getProgress(userId) {
  const streakRow = await getStreakRow(userId)
  const { data: answerRows, error } = await supabase
    .from('answers')
    .select('*')
    .eq('user_id', userId)
    .order('answered_at', { ascending: true })
  if (error) throw error

  return toProgress(streakRow, answerRows || [])
}

// A student's linked parent (if any), with the settings that parent controls.
async function getLinkedParent(studentId) {
  const { data: link, error: linkError } = await supabase
    .from('parent_student')
    .select(
      'parent_id, perfect_week_bonus, grade_reward_a_plus_cents, grade_reward_a_cents, grade_reward_b_cents, grade_reward_c_cents'
    )
    .eq('student_id', studentId)
    .maybeSingle()
  if (linkError) throw linkError
  if (!link) return null

  const { data: parent, error: parentError } = await supabase
    .from('users')
    .select('milestone_settings')
    .eq('id', link.parent_id)
    .maybeSingle()
  if (parentError) throw parentError

  return {
    parentId: link.parent_id,
    perfectWeekBonusDollars: Number(link.perfect_week_bonus ?? 10),
    milestoneSettings: parent?.milestone_settings ?? null,
    gradeRewardAPlusCents: link.grade_reward_a_plus_cents ?? 2500,
    gradeRewardACents: link.grade_reward_a_cents ?? 1500,
    gradeRewardBCents: link.grade_reward_b_cents ?? 1000,
    gradeRewardCCents: link.grade_reward_c_cents ?? 500,
  }
}

function normalizeMilestoneBonuses(milestoneSettings) {
  if (!milestoneSettings) return DEFAULT_MILESTONE_BONUSES
  const normalized = {}
  for (const [day, bonus] of Object.entries(milestoneSettings)) {
    normalized[Number(day)] = Number(bonus)
  }
  return normalized
}

// Fires once per student per week, the moment their weekly correct-first-attempt
// count reaches PERFECT_WEEK_TARGET. The unique (student_id, week_start)
// constraint makes this safe to call more than once for the same week.
async function recordPerfectWeekAchievement(studentId, parentId, perfectWeekBonusDollars, today) {
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

// Computes the result of answering today's question and persists both the
// new answer row and the updated streak/xp/coin totals.
export async function submitAnswer(progress, question, selectedIndex, subjectId, today) {
  const linkedParent = await getLinkedParent(progress.studentId)
  const milestoneBonuses = normalizeMilestoneBonuses(linkedParent?.milestoneSettings)
  const result = applyDailyAnswer(progress, question, selectedIndex, subjectId, today, milestoneBonuses)

  const { error: answerError } = await supabase.from('answers').insert({
    user_id: progress.studentId,
    subject: subjectId,
    question_text: question.prompt,
    selected_answer: question.options[selectedIndex],
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
    .eq('user_id', progress.studentId)
  if (streakError) throw streakError

  let perfectWeek = null
  if (result.correct && linkedParent) {
    const weeklyCount = getWeeklyCorrectCount(result.progress.history, today)
    if (weeklyCount === PERFECT_WEEK_TARGET) {
      const achievement = await recordPerfectWeekAchievement(
        progress.studentId,
        linkedParent.parentId,
        linkedParent.perfectWeekBonusDollars,
        today
      )
      if (achievement) {
        perfectWeek = { bonusCents: achievement.suggested_bonus_cents }
      }
    }
  }

  return { ...result, perfectWeek }
}

// ---------- Parent finances ----------
// Simulated money only — wallet_balance_cents etc. are plain columns on
// users, not backed by any real payment processor. Swappable for Stripe
// later without touching the rest of the app: addFundsToWallet is the only
// place that would need to become a real charge.

export async function getParentWallet(parentId) {
  const { data, error } = await supabase
    .from('users')
    .select('wallet_balance_cents, total_added_cents, total_paid_out_cents, coin_to_dollar_rate, milestone_settings')
    .eq('id', parentId)
    .single()
  if (error) throw error
  return {
    walletBalanceCents: data.wallet_balance_cents,
    totalAddedCents: data.total_added_cents,
    totalPaidOutCents: data.total_paid_out_cents,
    coinToDollarRate: data.coin_to_dollar_rate,
    milestoneSettings: data.milestone_settings,
  }
}

export async function addFundsToWallet(parentId, amountCents) {
  const wallet = await getParentWallet(parentId)
  const { error } = await supabase
    .from('users')
    .update({
      wallet_balance_cents: wallet.walletBalanceCents + amountCents,
      total_added_cents: wallet.totalAddedCents + amountCents,
    })
    .eq('id', parentId)
  if (error) throw error
}

export async function updateCoinRate(parentId, rate) {
  const { error } = await supabase.from('users').update({ coin_to_dollar_rate: rate }).eq('id', parentId)
  if (error) throw error
}

export async function updateMilestoneSettings(parentId, settings) {
  const { error } = await supabase.from('users').update({ milestone_settings: settings }).eq('id', parentId)
  if (error) throw error
}

// Converts a student's coins to dollars at the parent's current rate,
// deducts coins from the student and dollars from the parent's wallet, and
// logs the payout. XP is a permanent record and is never touched.
export async function payoutStudentCoins(parentId, studentId, coins, amountCents) {
  const streakRow = await getStreakRow(studentId)
  if (coins > streakRow.coin_balance) {
    throw new Error('Cannot pay out more coins than the student has.')
  }

  const { error: streakError } = await supabase
    .from('streaks')
    .update({ coin_balance: streakRow.coin_balance - coins })
    .eq('user_id', studentId)
  if (streakError) throw streakError

  const wallet = await getParentWallet(parentId)
  const { error: walletError } = await supabase
    .from('users')
    .update({
      wallet_balance_cents: wallet.walletBalanceCents - amountCents,
      total_paid_out_cents: wallet.totalPaidOutCents + amountCents,
    })
    .eq('id', parentId)
  if (walletError) throw walletError

  const { error: payoutError } = await supabase.from('payouts').insert({
    parent_id: parentId,
    student_id: studentId,
    coins,
    amount_cents: amountCents,
    type: 'manual',
  })
  if (payoutError) throw payoutError
}

export async function getPayoutHistory(parentId) {
  const { data: rows, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const studentIds = [...new Set((rows || []).map((r) => r.student_id))]
  let usernameById = {}
  if (studentIds.length > 0) {
    const { data: studentRows, error: studentError } = await supabase
      .from('users')
      .select('id, username')
      .in('id', studentIds)
    if (studentError) throw studentError
    usernameById = Object.fromEntries((studentRows || []).map((s) => [s.id, s.username]))
  }

  return (rows || []).map((r) => ({
    id: r.id,
    studentUsername: usernameById[r.student_id] || 'Unknown',
    coins: r.coins,
    amountCents: r.amount_cents,
    type: r.type || 'manual',
    date: r.created_at.slice(0, 10),
  }))
}

// ---------- Perfect week bonus ----------

export async function getPendingPerfectWeekAchievements(parentId) {
  const { data: rows, error } = await supabase
    .from('perfect_week_achievements')
    .select('*')
    .eq('parent_id', parentId)
    .eq('resolved', false)
    .order('created_at', { ascending: false })
  if (error) throw error

  const studentIds = [...new Set((rows || []).map((r) => r.student_id))]
  let usernameById = {}
  if (studentIds.length > 0) {
    const { data: studentRows, error: studentError } = await supabase
      .from('users')
      .select('id, username')
      .in('id', studentIds)
    if (studentError) throw studentError
    usernameById = Object.fromEntries((studentRows || []).map((s) => [s.id, s.username]))
  }

  return (rows || []).map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentUsername: usernameById[r.student_id] || 'Unknown',
    weekStart: r.week_start,
    suggestedBonusCents: r.suggested_bonus_cents,
  }))
}

// Confirming (or adjusting) a perfect-week bonus is the reverse of a normal
// payout: dollars leave the parent's wallet and are converted into coins
// added to the student's balance, rather than cashing coins out.
export async function resolvePerfectWeekAchievement(achievementId, parentId, studentId, amountCents) {
  const wallet = await getParentWallet(parentId)
  if (amountCents > wallet.walletBalanceCents) {
    throw new Error('Wallet balance is not enough to cover this bonus.')
  }
  const coinsToAdd = centsToCoins(amountCents, wallet.coinToDollarRate)

  const streakRow = await getStreakRow(studentId)
  const { error: streakError } = await supabase
    .from('streaks')
    .update({ coin_balance: streakRow.coin_balance + coinsToAdd })
    .eq('user_id', studentId)
  if (streakError) throw streakError

  const { error: walletError } = await supabase
    .from('users')
    .update({
      wallet_balance_cents: wallet.walletBalanceCents - amountCents,
      total_paid_out_cents: wallet.totalPaidOutCents + amountCents,
    })
    .eq('id', parentId)
  if (walletError) throw walletError

  const { error: payoutError } = await supabase.from('payouts').insert({
    parent_id: parentId,
    student_id: studentId,
    coins: coinsToAdd,
    amount_cents: amountCents,
    type: 'perfect_week_bonus',
  })
  if (payoutError) throw payoutError

  const { error: achievementError } = await supabase
    .from('perfect_week_achievements')
    .update({ resolved: true, resolved_amount_cents: amountCents, resolved_at: new Date().toISOString() })
    .eq('id', achievementId)
  if (achievementError) throw achievementError
}

// ---------- Grade-based payout bonus ----------
// Same shape as the perfect-week bonus above: a suggested amount is recorded
// once (idempotent per source row) when a qualifying grade comes in, and the
// parent explicitly confirms or adjusts it — this never pays automatically.
// A bonus can be triggered by either source: a graded test upload
// (uploadId set) or a manually-logged grade (gradeId set) — exactly one is
// ever set on a given grade_bonuses row.

// Fires whenever a grade lands (via upload or manual entry) and the student
// has a linked parent whose reward settings suggest a non-zero bonus for it.
// Silently no-ops (returns null) below 60% or with no linked parent.
async function maybeCreateGradeBonusForSource({ userId, gradePercentage, uploadId = null, gradeId = null }) {
  const linkedParent = await getLinkedParent(userId)
  if (!linkedParent) return null

  const suggestedBonusCents = computeSuggestedBonusCents(gradePercentage, linkedParent)
  if (suggestedBonusCents <= 0) return null

  const { data, error } = await supabase
    .from('grade_bonuses')
    .insert({
      upload_id: uploadId,
      grade_id: gradeId,
      student_id: userId,
      parent_id: linkedParent.parentId,
      grade_received: gradePercentage,
      suggested_bonus_cents: suggestedBonusCents,
    })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return null // already recorded for this source
    throw error
  }
  return data
}

export async function getPendingGradeBonuses(parentId) {
  const { data: rows, error } = await supabase
    .from('grade_bonuses')
    .select('*, uploads(subject, topic), grades(subject, test_name)')
    .eq('parent_id', parentId)
    .eq('resolved', false)
    .order('created_at', { ascending: false })
  if (error) throw error

  const studentIds = [...new Set((rows || []).map((r) => r.student_id))]
  let usernameById = {}
  if (studentIds.length > 0) {
    const { data: studentRows, error: studentError } = await supabase
      .from('users')
      .select('id, username')
      .in('id', studentIds)
    if (studentError) throw studentError
    usernameById = Object.fromEntries((studentRows || []).map((s) => [s.id, s.username]))
  }

  return (rows || []).map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentUsername: usernameById[r.student_id] || 'Unknown',
    subject: r.uploads?.subject || r.grades?.subject,
    topic: r.uploads?.topic || r.grades?.test_name,
    gradeReceived: r.grade_received,
    suggestedBonusCents: r.suggested_bonus_cents,
  }))
}

// Confirming (or adjusting) a grade bonus is the same coins-in-exchange-for-
// wallet-dollars flow as resolvePerfectWeekAchievement.
export async function resolveGradeBonus(bonusId, parentId, studentId, amountCents) {
  const wallet = await getParentWallet(parentId)
  if (amountCents > wallet.walletBalanceCents) {
    throw new Error('Wallet balance is not enough to cover this bonus.')
  }
  const coinsToAdd = centsToCoins(amountCents, wallet.coinToDollarRate)

  const streakRow = await getStreakRow(studentId)
  const { error: streakError } = await supabase
    .from('streaks')
    .update({ coin_balance: streakRow.coin_balance + coinsToAdd })
    .eq('user_id', studentId)
  if (streakError) throw streakError

  const { error: walletError } = await supabase
    .from('users')
    .update({
      wallet_balance_cents: wallet.walletBalanceCents - amountCents,
      total_paid_out_cents: wallet.totalPaidOutCents + amountCents,
    })
    .eq('id', parentId)
  if (walletError) throw walletError

  const { error: payoutError } = await supabase.from('payouts').insert({
    parent_id: parentId,
    student_id: studentId,
    coins: coinsToAdd,
    amount_cents: amountCents,
    type: 'grade_bonus',
  })
  if (payoutError) throw payoutError

  const { error: bonusError } = await supabase
    .from('grade_bonuses')
    .update({ resolved: true, resolved_amount_cents: amountCents, resolved_at: new Date().toISOString() })
    .eq('id', bonusId)
  if (bonusError) throw bonusError
}

// ---------- Document uploads ----------

export async function createUpload({ userId, documentType, subject, topic, gradeReceived, testDate, notes, summary, keyConcepts, pagesCount }) {
  const { data, error } = await supabase
    .from('uploads')
    .insert({
      user_id: userId,
      document_type: documentType,
      subject,
      topic,
      grade_received: gradeReceived,
      test_date: testDate,
      notes,
      summary,
      key_concepts: keyConcepts,
      pages_count: pagesCount,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

async function createUploadQuestions(uploadId, questions) {
  if (!questions || questions.length === 0) return
  const rows = questions.map((q) => ({
    upload_id: uploadId,
    question: q.question,
    correct_answer: q.correct_answer,
    options: q.options,
    explanation: q.explanation,
    difficulty: q.difficulty,
  }))
  const { error } = await supabase.from('upload_questions').insert(rows)
  if (error) throw error
}

// One call to persist everything from a processed upload: the uploads row,
// its extracted questions, and — for a graded test — the grade-bonus check.
export async function saveUpload({ userId, documentType, subject, topic, gradeReceived, testDate, notes, aiResult, pagesCount }) {
  const upload = await createUpload({
    userId,
    documentType,
    subject,
    topic,
    gradeReceived,
    testDate,
    notes,
    summary: aiResult.summary,
    keyConcepts: aiResult.key_concepts,
    pagesCount,
  })
  await createUploadQuestions(upload.id, aiResult.questions)
  if (documentType === 'test' && gradeReceived != null) {
    await maybeCreateGradeBonusForSource({ userId, gradePercentage: gradeReceived, uploadId: upload.id })
  }
  return { ...upload, questions: aiResult.questions || [] }
}

// Appends another upload session's pages to an existing upload: the new
// questions join the same upload_questions bank, and pages_count/updated_at
// track that more pages were added later (see UploadCaptureScreen's
// existingUpload mode).
export async function addPagesToUpload({ uploadId, questions, pagesAdded }) {
  await createUploadQuestions(uploadId, questions)
  const { data, error } = await supabase
    .from('uploads')
    .select('pages_count')
    .eq('id', uploadId)
    .single()
  if (error) throw error

  const { error: updateError } = await supabase
    .from('uploads')
    .update({ pages_count: (data.pages_count || 0) + pagesAdded, updated_at: new Date().toISOString() })
    .eq('id', uploadId)
  if (updateError) throw updateError
}

export async function getUploadsForUser(userId) {
  const { data, error } = await supabase
    .from('uploads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getUploadDetail(uploadId) {
  const { data: upload, error } = await supabase.from('uploads').select('*').eq('id', uploadId).single()
  if (error) throw error
  const { data: questions, error: questionsError } = await supabase
    .from('upload_questions')
    .select('*')
    .eq('upload_id', uploadId)
    .order('created_at', { ascending: true })
  if (questionsError) throw questionsError
  return { ...upload, questions: questions || [] }
}

// All graded test uploads across a parent's linked students, newest test first.
export async function getTestGradesForParent(parentId) {
  const students = await getStudentsForParent(parentId)
  if (students.length === 0) return []

  const { data, error } = await supabase
    .from('uploads')
    .select('*')
    .in(
      'user_id',
      students.map((s) => s.id)
    )
    .eq('document_type', 'test')
    .not('grade_received', 'is', null)
    .order('test_date', { ascending: false })
  if (error) throw error

  const nameById = Object.fromEntries(students.map((s) => [s.id, s.display_name || s.username]))
  return (data || []).map((row) => ({ ...row, studentName: nameById[row.user_id] || 'Unknown' }))
}

// ---------- Grades (manual tracker) ----------
// Independent of Test Prep and uploads — a student can log any grade at any
// time. Still feeds the same grade-bonus payout flow as an uploaded test.

export async function createGrade({ userId, subject, testName, gradePercentage, testDate, notes }) {
  const { data, error } = await supabase
    .from('grades')
    .insert({
      user_id: userId,
      subject,
      test_name: testName,
      grade_percentage: gradePercentage,
      test_date: testDate,
      notes,
    })
    .select()
    .single()
  if (error) throw error

  await maybeCreateGradeBonusForSource({ userId, gradePercentage, gradeId: data.id })
  return data
}

export async function getGradesForUser(userId) {
  const { data, error } = await supabase
    .from('grades')
    .select('*')
    .eq('user_id', userId)
    .order('test_date', { ascending: false })
  if (error) throw error
  return data || []
}

// ---------- Test prep (premium) ----------

// Pulls from the student's own uploaded documents (see Document uploads
// below) as the primary source for a study plan, when they've uploaded
// something matching this subject/topic.
export async function getUploadedQuestions(userId, subject, topic) {
  const { data, error } = await supabase
    .from('upload_questions')
    .select('question, correct_answer, options, explanation, uploads!inner(user_id, subject, topic)')
    .eq('uploads.user_id', userId)
    .eq('uploads.subject', subject)
    .ilike('uploads.topic', `%${topic.trim()}%`)
  if (error) throw error
  return (data || []).map((row) => ({
    question: row.question,
    correct_answer: row.correct_answer,
    options: row.options,
    explanation: row.explanation,
  }))
}

// Every question the student has ever uploaded for a subject, regardless of
// topic — used by the Test Prep / Study Guide source picker (see
// questionSource.js), which lets the student choose to draw from these
// directly instead of the topic-scoped getUploadedQuestions above. Only
// rows that came from an already-multiple-choice source document are
// usable here (options must be non-empty and actually contain the
// recorded correct answer) — shaped to match QUESTION_SCHEMA (options +
// 0-based correct index) so callers can drop them straight into a plan.
export async function getUploadedQuestionsForSubject(userId, subject) {
  const { data, error } = await supabase
    .from('upload_questions')
    .select('question, correct_answer, options, explanation, uploads!inner(user_id, subject)')
    .eq('uploads.user_id', userId)
    .eq('uploads.subject', subject)
  if (error) throw error
  return (data || [])
    .filter((row) => row.options && row.options.length > 0 && row.options.includes(row.correct_answer))
    .map((row) => ({
      question: row.question,
      options: row.options,
      correct: row.options.indexOf(row.correct_answer),
      explanation: row.explanation,
    }))
}

export async function createStudyPlan({ userId, subject, topic, testDate, daysAvailable, gradeLevel, planData }) {
  const { data, error } = await supabase
    .from('study_plans')
    .insert({
      user_id: userId,
      subject,
      topic,
      test_date: testDate,
      days_available: daysAvailable,
      grade_level: gradeLevel,
      plan_data: planData,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// The most recent active plan whose test hasn't passed yet. A plan the
// student marked done or cancelled stops showing here even if its test_date
// is still in the future.
export async function getActiveStudyPlan(userId) {
  const { data, error } = await supabase
    .from('study_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('test_date', todayStr())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateStudyPlanData(planId, planData) {
  const { error } = await supabase.from('study_plans').update({ plan_data: planData }).eq('id', planId)
  if (error) throw error
}

export async function completeStudyPlan(planId) {
  const { error } = await supabase.from('study_plans').update({ status: 'completed' }).eq('id', planId)
  if (error) throw error
}

export async function cancelStudyPlan(planId) {
  const { error } = await supabase.from('study_plans').update({ status: 'cancelled' }).eq('id', planId)
  if (error) throw error
}

// Completed and cancelled plans, most recent test first — for the Past
// Plans section. Plans that simply expired without being marked either way
// are not included (they're still technically 'active', just past their
// test date, and quietly stop showing on the home screen on their own).
export async function getPastStudyPlans(userId) {
  const { data, error } = await supabase
    .from('study_plans')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['completed', 'cancelled'])
    .order('test_date', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getActiveStudyPlansForParent(parentId) {
  const students = await getStudentsForParent(parentId)
  if (students.length === 0) return []

  const { data, error } = await supabase
    .from('study_plans')
    .select('*')
    .in('user_id', students.map((s) => s.id))
    .eq('status', 'active')
    .gte('test_date', todayStr())
    .order('test_date', { ascending: true })
  if (error) throw error

  const usernameById = Object.fromEntries(students.map((s) => [s.id, s.display_name || s.username]))
  return (data || []).map((plan) => ({ ...plan, studentName: usernameById[plan.user_id] || 'Unknown' }))
}

// ---------- Practice ----------
// Unlike Test Prep/Study Guide, Practice sessions do award coins (never XP —
// XP stays exclusive to the daily question).

export async function awardCoins(userId, amount) {
  const streakRow = await getStreakRow(userId)
  const { error } = await supabase
    .from('streaks')
    .update({ coin_balance: streakRow.coin_balance + amount })
    .eq('user_id', userId)
  if (error) throw error
}

export async function savePracticeSession({ userId, subject, topic, scorePercentage, questionsCorrect, questionsTotal, coinsEarned }) {
  const { data, error } = await supabase
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
  return data
}

export async function getRecentPracticeSessions(userId, limit = 5) {
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

// ---------- Leaderboard ----------

// Ranked by total XP. Streak is recomputed with the same day-gap decay used
// everywhere else in the app, rather than trusting the raw stored value, so
// a lapsed streak doesn't show stale. userIds, if given, scopes the ranking
// to just those students (used for the friends leaderboard); omit for global.
async function fetchLeaderboardRows(userIds) {
  let query = supabase
    .from('streaks')
    .select('current_streak, total_xp, last_answered_date, user_id, users:user_id(username, grade, account_type)')
    .order('total_xp', { ascending: false })
  if (userIds) query = query.in('user_id', userIds)

  const { data, error } = await query
  if (error) throw error

  const today = todayStr()
  return (data || [])
    .filter((row) => row.users?.account_type === 'student')
    .map((row) => ({
      userId: row.user_id,
      username: row.users.username,
      grade: row.users.grade,
      xp: row.total_xp,
      streak: getEffectiveStreak({ streak: row.current_streak, lastCorrectDate: row.last_answered_date }, today),
    }))
}

export async function getLeaderboard() {
  return fetchLeaderboardRows()
}

export async function getFriendsLeaderboard(userId) {
  const friendIds = await getFriendIds(userId)
  return fetchLeaderboardRows([userId, ...friendIds])
}

// ---------- Friends ----------

async function getFriendIds(userId) {
  const { data, error } = await supabase.from('friends').select('friend_id').eq('user_id', userId)
  if (error) throw error
  return (data || []).map((r) => r.friend_id)
}

export async function getFriendCount(userId) {
  const { count, error } = await supabase
    .from('friends')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw error
  return count || 0
}

export async function getFriendsWithStreaks(userId) {
  const friendIds = await getFriendIds(userId)
  if (friendIds.length === 0) return []

  const { data, error } = await supabase
    .from('streaks')
    .select('user_id, current_streak, last_answered_date, users:user_id(username, grade, avatar)')
    .in('user_id', friendIds)
  if (error) throw error

  const today = todayStr()
  return (data || []).map((row) => ({
    id: row.user_id,
    username: row.users?.username,
    grade: row.users?.grade,
    avatar: row.users?.avatar,
    streak: getEffectiveStreak({ streak: row.current_streak, lastCorrectDate: row.last_answered_date }, today),
  }))
}

export async function searchStudentsByUsername(query, excludeUserId) {
  const trimmed = query.trim()
  if (!trimmed) return []
  const { data, error } = await supabase
    .from('users')
    .select('id, username, grade')
    .eq('account_type', 'student')
    .ilike('username', `%${trimmed}%`)
    .neq('id', excludeUserId)
    .limit(10)
  if (error) throw error
  return data || []
}

async function findExistingFriendRequest(userAId, userBId) {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .or(`and(sender_id.eq.${userAId},receiver_id.eq.${userBId}),and(sender_id.eq.${userBId},receiver_id.eq.${userAId})`)
    .in('status', ['pending', 'accepted'])
    .maybeSingle()
  if (error) throw error
  return data
}

export async function sendFriendRequest(senderId, receiverId) {
  if (senderId === receiverId) throw new Error("You can't follow yourself.")
  const existing = await findExistingFriendRequest(senderId, receiverId)
  if (existing) {
    throw new Error(existing.status === 'accepted' ? 'You are already friends.' : 'A request is already pending.')
  }
  const { error } = await supabase
    .from('friend_requests')
    .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending' })
  if (error) throw error
}

export async function getPendingFriendRequests(userId) {
  const { data: rows, error } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('receiver_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error

  const senderIds = [...new Set((rows || []).map((r) => r.sender_id))]
  let usernameById = {}
  if (senderIds.length > 0) {
    const { data: senderRows, error: senderError } = await supabase
      .from('users')
      .select('id, username')
      .in('id', senderIds)
    if (senderError) throw senderError
    usernameById = Object.fromEntries((senderRows || []).map((s) => [s.id, s.username]))
  }

  return (rows || []).map((r) => ({
    id: r.id,
    senderId: r.sender_id,
    senderUsername: usernameById[r.sender_id] || 'Unknown',
  }))
}

// Accepting inserts both directions of the friendship in one go; the unique
// constraint makes a double-click (or double-accept race) harmless.
export async function respondToFriendRequest(requestId, accept) {
  const { data: request, error: fetchError } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('id', requestId)
    .single()
  if (fetchError) throw fetchError

  const { error: updateError } = await supabase
    .from('friend_requests')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', requestId)
  if (updateError) throw updateError

  if (accept) {
    const { error: friendError } = await supabase.from('friends').insert([
      { user_id: request.sender_id, friend_id: request.receiver_id },
      { user_id: request.receiver_id, friend_id: request.sender_id },
    ])
    if (friendError && friendError.code !== '23505') throw friendError
  }
}

// ---------- Streak sharing ----------

// share_date is set explicitly (rather than relying on a DB-side default)
// so "today" always matches the app's UTC-day convention (todayStr()),
// regardless of the database server's timezone setting. The unique
// constraint on (sender_id, receiver_id, share_date) makes a repeat share on
// the same day a no-op rather than an error.
export async function shareStreakWithFriend(senderId, receiverId, senderStreak) {
  const { error } = await supabase.from('streak_shares').insert({
    sender_id: senderId,
    receiver_id: receiverId,
    sender_streak: senderStreak,
    share_date: todayStr(),
  })
  if (error) {
    if (error.code === '23505') return // already shared with this friend today
    throw error
  }
}

// Every share involving this user, in either direction — used client-side to
// derive "shared with this friend today" and the mutual share streak per
// friend without an extra round trip per friend.
export async function getStreakSharesForUser(userId) {
  const { data, error } = await supabase
    .from('streak_shares')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
  if (error) throw error
  return data || []
}

// Shares received today, with sender identity — for the "shared with you
// today" list and the home-screen notification badge count.
export async function getTodaysReceivedShares(userId) {
  const { data, error } = await supabase
    .from('streak_shares')
    .select('*, users:sender_id(username, avatar)')
    .eq('receiver_id', userId)
    .eq('share_date', todayStr())
    .order('shared_at', { ascending: false })
  if (error) throw error
  return (data || []).map((r) => ({
    id: r.id,
    senderUsername: r.users?.username || 'Unknown',
    senderAvatar: r.users?.avatar || null,
    senderStreak: r.sender_streak,
    sharedAt: r.shared_at,
  }))
}

// ---------- Curriculum outlines ----------
// A shared, global cache (no user_id) — one row per subject+grade, generated
// by Claude exactly once and reused by every student forever.

export async function getCurriculumOutline(subject, grade) {
  const { data, error } = await supabase
    .from('curriculum_outlines')
    .select('*')
    .eq('subject', subject)
    .eq('grade', grade)
    .maybeSingle()
  if (error) throw error
  return data
}

// If two students open the same never-before-seen subject+grade at the same
// moment, both may reach this after the "doesn't exist yet" check — the
// unique constraint lets only the first insert win, and the loser just reads
// back the winner's row instead of erroring (same pattern as
// shareStreakWithFriend's 23505 handling above).
export async function saveCurriculumOutline(subject, grade, outlineData) {
  const { data, error } = await supabase
    .from('curriculum_outlines')
    .insert({ subject, grade, outline_data: outlineData })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') {
      const existing = await getCurriculumOutline(subject, grade)
      if (existing) return existing
    }
    throw error
  }
  return data
}
