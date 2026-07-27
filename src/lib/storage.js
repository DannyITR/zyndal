import { supabase } from './supabaseClient'
import { hashPassword, comparePassword, isBcryptHash } from './password'
import { XP_PER_CORRECT, COINS_PER_CORRECT, todayStr } from './streak'
import { findQuestionByPrompt } from './questions'
import { computeSuggestedBonusCents } from './gradeReward'

// This key is duplicated (not imported) in supabaseClient.js, which reads
// it to attach the X-Session-Token header to every request — storage.js
// already imports supabaseClient.js, so the reverse import would be circular.
const SESSION_KEY = 'zyndal_session'

// Session 3: student-data and questions calls now go through /api/student
// and /api/questions serverless functions (session-token authenticated)
// instead of direct Supabase queries — see api/_lib/auth.js and
// api/_lib/db.js, which mirror the relevant pure logic and private helpers
// from this file. Only migrated where the call is always about the
// CURRENTLY authenticated user's own data: getProgress() is deliberately
// NOT migrated, since ParentDashboard/FinanceScreen call it for a parent's
// *other* linked students too, which the new self-only session-auth
// endpoints don't support without cross-user authorization that wasn't
// part of this migration.
let sessionExpiredHandler = null
// Registered once by App.jsx so any 401 from these endpoints — not just
// the initial page-load check — redirects to the login screen immediately,
// without every calling component needing its own 401 handling.
export function setSessionExpiredHandler(fn) {
  sessionExpiredHandler = fn
}

async function callApi(basePath, method, endpoint, body) {
  const token = getSessionToken()
  let response
  try {
    response = await fetch(`${basePath}/${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Session-Token': token } : {}),
      },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    })
  } catch {
    throw new Error('Connection error — please try again.')
  }

  const data = await response.json().catch(() => null)

  if (response.status === 401) {
    clearSession()
    sessionExpiredHandler?.()
    throw new Error(data?.error || 'Your session has expired. Please log in again.')
  }
  if (!response.ok) {
    throw new Error(data?.error || `Request to ${endpoint} failed (${response.status}).`)
  }
  return data
}

function callStudentApi(method, endpoint, body) {
  return callApi('/api/student', method, endpoint, body)
}

function callParentApi(method, endpoint, body) {
  return callApi('/api/parent', method, endpoint, body)
}

function callSocialApi(method, endpoint, body) {
  return callApi('/api/social', method, endpoint, body)
}

function callUploadsApi(method, endpoint, body) {
  return callApi('/api/uploads', method, endpoint, body)
}

function callCurriculumApi(method, endpoint, body) {
  return callApi('/api/curriculum', method, endpoint, body)
}

// Session 4: ParentDashboard and FinanceScreen each already fetch several
// small, always-together pieces on mount via Promise.all (students,
// wallet, study plans, pending bonuses, payout history, per-student
// progress...). Rather than giving each its own endpoint, /api/parent/
// get-dashboard returns all of it in one round trip, and every parent-only
// getter below shares ONE in-flight/cached request for it — a burst of
// calls in the same tick (e.g. a Promise.all) collapses to a single fetch,
// since the promise is cached synchronously before any await happens.
// Mutations invalidate the cache so the next read is fresh.
let parentDashboardCache = null

function fetchParentDashboard(parentId) {
  if (parentDashboardCache?.parentId === parentId) return parentDashboardCache.promise
  const promise = callParentApi('GET', 'get-dashboard').catch((err) => {
    if (parentDashboardCache?.promise === promise) parentDashboardCache = null
    throw err
  })
  parentDashboardCache = { parentId, promise }
  return promise
}

function invalidateParentDashboard() {
  parentDashboardCache = null
}

// Same dedup-cache pattern as the parent dashboard above, for
// /api/social/get-friends — FriendsScreen and ShareStreakScreen each fetch
// friends+requests+shares together on mount.
let friendsDashboardCache = null

function fetchFriendsDashboard(userId) {
  if (friendsDashboardCache?.userId === userId) return friendsDashboardCache.promise
  const promise = callSocialApi('GET', 'get-friends').catch((err) => {
    if (friendsDashboardCache?.promise === promise) friendsDashboardCache = null
    throw err
  })
  friendsDashboardCache = { userId, promise }
  return promise
}

function invalidateFriendsDashboard() {
  friendsDashboardCache = null
}

// ---------- Session ----------
// A signed-in device holds a random session token (crypto.randomUUID()),
// issued into the `sessions` table on login/signup and looked up — not
// trusted from localStorage alone — on every getCurrentUser() call. This is
// the client half of the session-token system; nothing server-side (RLS
// policy or serverless function) validates the token yet, so on its own
// this doesn't restrict data access — see supabase/schema.sql for the
// `sessions` table and the plan for what comes next.

export function getSessionToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw).token : null
  } catch {
    return null
  }
}

// Called on successful login/signup — issues a fresh token, persists it to
// Supabase, and stores it as this device's session.
export async function createSession(userId) {
  const token = crypto.randomUUID()
  const { error } = await supabase.from('sessions').insert({ user_id: userId, token })
  if (error) throw error
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token }))
  return token
}

// Clears the local session immediately (so the UI can log the user out
// without waiting on a network round trip) and deletes the matching row
// from Supabase in the background — best-effort, since a session that
// merely expires after 30 days is an acceptable fallback if this fails.
export function clearSession() {
  const token = getSessionToken()
  localStorage.removeItem(SESSION_KEY)
  if (!token) return
  supabase
    .from('sessions')
    .delete()
    .eq('token', token)
    .then(({ error }) => {
      if (error) console.error('[storage] failed to delete session:', error)
    })
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
  const hashedPassword = await hashPassword(password)
  const { data, error } = await supabase
    .from('users')
    .insert({ username, password: hashedPassword, account_type: accountType, grade, parent_code: parentCode })
    .select()
    .single()
  if (error) throw error

  if (accountType === 'student') {
    const { error: streakError } = await supabase.from('streaks').insert({ user_id: data.id })
    if (streakError) throw streakError
  }

  return data
}

// grade and languagePreference are only meaningful for students; pass the
// existing value through for parents. userId isn't sent — the server
// derives who's editing from the session token (see
// api/student/update-settings.js) — but stays in the signature since
// SettingsScreen.jsx calls this positionally.
export async function updateUserProfile(userId, { displayName, email, schoolName, avatar, grade, languagePreference }) {
  return callStudentApi('POST', 'update-settings', {
    display_name: displayName,
    email,
    school: schoolName,
    avatar,
    grade,
    language_preference: languagePreference,
  })
}

// Checks a plain-text password against a user row that may still have its
// original plain-text password (pre-dating bcrypt hashing) or an already
// hashed one. On a successful match against a legacy plain-text row, it
// silently rewrites the row with a proper bcrypt hash — every account
// migrates itself the next time its owner logs in or changes their
// password, with no forced reset.
async function verifyAndMigratePassword(user, plainTextPassword) {
  if (isBcryptHash(user.password)) {
    return comparePassword(plainTextPassword, user.password)
  }
  if (user.password !== plainTextPassword) return false

  const hashed = await hashPassword(plainTextPassword)
  const { error } = await supabase.from('users').update({ password: hashed }).eq('id', user.id)
  if (error) console.error('[storage] silent password migration failed:', error)
  return true
}

export async function verifyLogin(username, password) {
  const user = await findUserByUsername(username)
  if (!user) return null
  const valid = await verifyAndMigratePassword(user, password)
  return valid ? user : null
}

// userId isn't sent — the server derives who's changing their password from
// the session token (see api/student/change-password.js) — but stays in
// the signature since SettingsScreen.jsx calls this positionally.
export async function changePassword(userId, currentPassword, newPassword) {
  await callStudentApi('POST', 'change-password', { current_password: currentPassword, new_password: newPassword })
}

export async function getCurrentUser() {
  const token = getSessionToken()
  if (!token) return null
  try {
    return await callStudentApi('GET', 'get-profile')
  } catch {
    // Invalid/expired session (already cleared by callApi on a 401) or a
    // network hiccup — either way, treat it as logged out.
    clearSession()
    return null
  }
}

// ---------- Parent <-> student links ----------

export async function linkParentAndStudent(parentId, studentId) {
  const { error } = await supabase.from('parent_student').insert({ parent_id: parentId, student_id: studentId })
  if (error) throw error
}

// Session 4: reads from the shared dashboard fetch (see
// fetchParentDashboard above) instead of querying parent_student/users
// directly — stripped back down to the same shape this function always
// returned (no progress/practice/grades, which the dashboard also carries
// for other callers). Also fixes a pre-existing bug: the old direct query
// used `select('*')` on users, which included the bcrypt password hash in
// every student object handed to the parent's browser; get-dashboard.js
// uses an explicit safe column list instead (see STUDENT_SAFE_COLUMNS).
export async function getStudentsForParent(parentId) {
  const dash = await fetchParentDashboard(parentId)
  return dash.students.map(({ progress: _progress, recentPracticeSessions: _sessions, grades: _grades, ...student }) => student)
}

export async function updatePerfectWeekBonus(parentId, studentId, amountDollars) {
  await callParentApi('POST', 'update-settings', { student_id: studentId, perfect_week_bonus: amountDollars })
  invalidateParentDashboard()
}

export async function updateGradeRewardSettings(parentId, studentId, { aPlusCents, aCents, bCents, cCents }) {
  await callParentApi('POST', 'update-settings', {
    student_id: studentId,
    grade_thresholds: { aPlusCents, aCents, bCents, cCents },
  })
  invalidateParentDashboard()
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

// Computes the result of answering today's question and persists both the
// new answer row and the updated streak/xp/coin totals. question and today
// aren't sent — the server looks up today's actual question itself and
// derives correctness/streak/milestones/perfect-week server-side (see
// api/student/submit-answer.js, which reuses the exact same
// applyDailyAnswer logic from src/lib/streak.js) — both params stay in the
// signature only because StudentHome.jsx calls this positionally.
export async function submitAnswer(progress, question, selectedIndex, subjectId, _today) {
  const data = await callStudentApi('POST', 'submit-answer', { subject: subjectId, selected_index: selectedIndex })

  const newProgress = {
    ...progress,
    streak: data.new_streak,
    longestStreak: data.longest_streak,
    xp: data.new_xp_total,
    coins: data.new_coins_total,
    lastCorrectDate: data.last_correct_date,
    history: [...progress.history, data.entry],
  }

  return {
    progress: newProgress,
    correct: data.correct,
    coinsEarned: data.coins_earned,
    xpEarned: data.xp_earned,
    milestoneHit: data.milestone_reached,
    bonusEarned: data.bonus_earned,
    perfectWeek: data.perfect_week_bonus_cents != null ? { bonusCents: data.perfect_week_bonus_cents } : null,
  }
}

// ---------- Parent finances ----------
// Simulated money only — wallet_balance_cents etc. are plain columns on
// users, not backed by any real payment processor. Swappable for Stripe
// later without touching the rest of the app: addFundsToWallet is the only
// place that would need to become a real charge.

// Session 4: reads pull from the shared dashboard fetch; mutations call
// their own endpoint and invalidate the cache so the next read is fresh
// (see fetchParentDashboard/invalidateParentDashboard above).
export async function getParentWallet(parentId) {
  const dash = await fetchParentDashboard(parentId)
  return dash.wallet
}

export async function addFundsToWallet(parentId, amountCents) {
  await callParentApi('POST', 'add-funds', { amount_cents: amountCents })
  invalidateParentDashboard()
}

export async function updateCoinRate(parentId, rate) {
  await callParentApi('POST', 'update-settings', { coin_rate: rate })
  invalidateParentDashboard()
}

export async function updateMilestoneSettings(parentId, settings) {
  await callParentApi('POST', 'update-settings', { milestone_settings: settings })
  invalidateParentDashboard()
}

// coins is sent alongside amountCents (the /api/parent/payout endpoint
// accepts both) rather than re-derived server-side from amountCents and the
// coin rate — recomputing would risk rounding drift from the coin count the
// parent actually saw and confirmed on the PayoutModal.
export async function payoutStudentCoins(parentId, studentId, coins, amountCents) {
  await callParentApi('POST', 'payout', { student_id: studentId, coins, amount_cents: amountCents, payout_type: 'manual' })
  invalidateParentDashboard()
}

export async function getPayoutHistory(parentId) {
  const dash = await fetchParentDashboard(parentId)
  return dash.payoutHistory
}

// ---------- Perfect week bonus ----------

export async function getPendingPerfectWeekAchievements(parentId) {
  const dash = await fetchParentDashboard(parentId)
  return dash.pendingPerfectWeekAchievements
}

// Confirming (or adjusting) a perfect-week bonus is the reverse of a normal
// payout: dollars leave the parent's wallet and are converted into coins
// added to the student's balance, rather than cashing coins out. studentId
// isn't sent — the server looks up which student the achievement belongs to
// from the achievement row itself — but stays in the signature since
// FinanceScreen.jsx calls this positionally.
export async function resolvePerfectWeekAchievement(achievementId, parentId, _studentId, amountCents) {
  await callParentApi('POST', 'resolve-bonus', { bonus_id: achievementId, bonus_type: 'perfect_week', amount_cents: amountCents, confirmed: true })
  invalidateParentDashboard()
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
  const dash = await fetchParentDashboard(parentId)
  return dash.pendingGradeBonuses
}

// Confirming (or adjusting) a grade bonus is the same coins-in-exchange-for-
// wallet-dollars flow as resolvePerfectWeekAchievement. studentId isn't
// sent, for the same reason noted there.
export async function resolveGradeBonus(bonusId, parentId, _studentId, amountCents) {
  await callParentApi('POST', 'resolve-bonus', { bonus_id: bonusId, bonus_type: 'grade_bonus', amount_cents: amountCents, confirmed: true })
  invalidateParentDashboard()
}

// ---------- Document uploads ----------
// Session 4: saveUpload/addPagesToUpload now compose two endpoints
// (save-upload, save-questions) instead of inserting into uploads/
// upload_questions directly — createUpload/createUploadQuestions (the old
// internal helpers those two composed locally) are gone, since the actual
// inserts happen server-side now. The grade-bonus check that used to run
// here after saveUpload's insert also moved server-side, into
// api/uploads/save-upload.js's handler.

// One call to persist everything from a processed upload: the uploads row
// and its extracted questions (and, server-side, the grade-bonus check for
// a graded test).
export async function saveUpload({ userId: _userId, documentType, subject, topic, gradeReceived, testDate, notes, aiResult, pagesCount }) {
  const upload = await callUploadsApi('POST', 'save-upload', {
    subject,
    topic,
    grade_received: gradeReceived,
    test_date: testDate,
    notes,
    summary: aiResult.summary,
    key_concepts: aiResult.key_concepts,
    document_type: documentType,
    pages_count: pagesCount,
  })
  if (aiResult.questions && aiResult.questions.length > 0) {
    await callUploadsApi('POST', 'save-questions', { upload_id: upload.id, questions: aiResult.questions })
  }
  return { ...upload, questions: aiResult.questions || [] }
}

// Appends another upload session's pages to an existing upload: the new
// questions join the same upload_questions bank, and pages_count/updated_at
// track that more pages were added later (see UploadCaptureScreen's
// existingUpload mode).
export async function addPagesToUpload({ uploadId, questions, pagesAdded }) {
  await callUploadsApi('POST', 'save-questions', { upload_id: uploadId, questions, pages_added: pagesAdded })
}

// userId isn't sent — the server scopes to the caller's own uploads from
// the session token (see api/uploads/get-uploads.js) — but stays in the
// signature since UploadsLibraryScreen.jsx calls this positionally.
export async function getUploadsForUser(_userId) {
  const data = await callUploadsApi('GET', 'get-uploads')
  return data || []
}

export async function getUploadDetail(uploadId) {
  const data = await callUploadsApi('GET', `get-upload-questions?upload_id=${encodeURIComponent(uploadId)}`)
  return { ...data.upload, questions: data.questions }
}

// All graded test uploads across a parent's linked students, newest test first.
export async function getTestGradesForParent(parentId) {
  const dash = await fetchParentDashboard(parentId)
  return dash.testGrades
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
  const data = await callUploadsApi('GET', `get-upload-questions?subject=${encodeURIComponent(subject)}`)
  const trimmed = topic.trim().toLowerCase()
  return data.uploads
    .filter((upload) => (upload.topic || '').toLowerCase().includes(trimmed))
    .flatMap((upload) =>
      upload.questions.map((q) => ({
        question: q.question,
        correct_answer: q.correct_answer,
        options: q.options,
        explanation: q.explanation,
      }))
    )
}

// Every upload the student has for a subject, regardless of topic — used by
// the Test Prep / Study Guide source picker (see questionSource.js) to
// decide whether "My Uploads" / "Mix Both" are offered, and to actually
// build a question pool from them. Each upload comes back with whatever
// pre-extracted multiple-choice questions it already has (options must be
// non-empty and actually contain the recorded correct answer — shaped to
// QUESTION_SCHEMA so callers can drop them straight into a plan) PLUS its
// summary/key_concepts, so a caller can fall back to generating questions
// on the fly (see resolveUploadQuestionPool in questionSource.js) for an
// upload whose extracted content wasn't multiple-choice, or wasn't
// extracted as discrete questions at all.
export async function getUploadedContentForSubject(userId, subject) {
  const data = await callUploadsApi('GET', `get-upload-questions?subject=${encodeURIComponent(subject)}`)
  return data.uploads.map((upload) => ({
    uploadId: upload.uploadId,
    summary: upload.summary,
    keyConcepts: upload.keyConcepts || [],
    usableQuestions: upload.questions
      .filter((q) => q.options && q.options.length > 0 && q.options.includes(q.correct_answer))
      .map((q) => ({ question: q.question, options: q.options, correct: q.options.indexOf(q.correct_answer), explanation: q.explanation })),
  }))
}

// Persists questions generated on the fly from an upload's summary (see
// generateQuestionsFromUploadContent in ai.js) into upload_questions, so the
// same upload never needs a second Claude call — the next student session
// finds them as ordinary pre-extracted questions via getUploadedContentForSubject.
export async function cacheGeneratedUploadQuestions(uploadId, questions) {
  const rows = questions.map((q) => ({
    question: q.question,
    correct_answer: q.options[q.correct],
    options: q.options,
    explanation: q.explanation,
    difficulty: 'medium',
  }))
  await callUploadsApi('POST', 'save-questions', { upload_id: uploadId, questions: rows })
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
  const dash = await fetchParentDashboard(parentId)
  return dash.studyPlans
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

// Session 4: both now call /api/social/get-leaderboard?type=global|friends
// — userId on getFriendsLeaderboard isn't sent (the server derives "my
// friends" from the session token), but stays in the signature since
// Leaderboard.jsx calls this positionally.
export async function getLeaderboard() {
  return callSocialApi('GET', 'get-leaderboard?type=global')
}

export async function getFriendsLeaderboard(_userId) {
  return callSocialApi('GET', 'get-leaderboard?type=friends')
}

// ---------- Friends ----------
// Session 4: FriendsScreen and ShareStreakScreen each fetch several of these
// together via Promise.all on mount, so they all read from the shared
// /api/social/get-friends fetch (see fetchFriendsDashboard above) instead of
// querying friends/friend_requests/streak_shares directly.

export async function getFriendCount(userId) {
  const dash = await fetchFriendsDashboard(userId)
  return dash.friends.length
}

export async function getFriendsWithStreaks(userId) {
  const dash = await fetchFriendsDashboard(userId)
  return dash.friends
}

// excludeUserId isn't sent — the server excludes the caller (from the
// session token) and their existing friends automatically (see
// api/social/search-users.js) — but stays in the signature since
// FriendsScreen.jsx calls this positionally.
export async function searchStudentsByUsername(query, _excludeUserId) {
  if (!query.trim()) return []
  return callSocialApi('GET', `search-users?username=${encodeURIComponent(query)}`)
}

// receiverId is the target's user id — /api/social/friend-request also
// accepts a username (target_username), but the search results this is
// always called from already carry the id, so there's no reason to make the
// server re-resolve a username back to one.
export async function sendFriendRequest(senderId, receiverId) {
  await callSocialApi('POST', 'friend-request', { action: 'send', target_user_id: receiverId })
  invalidateFriendsDashboard()
}

export async function getPendingFriendRequests(userId) {
  const dash = await fetchFriendsDashboard(userId)
  return dash.pendingRequests.received
}

// Accepting inserts both directions of the friendship in one go server-side;
// see api/social/friend-request.js.
export async function respondToFriendRequest(requestId, accept) {
  await callSocialApi('POST', 'friend-request', { action: accept ? 'accept' : 'decline', request_id: requestId })
  invalidateFriendsDashboard()
}

// ---------- Streak sharing ----------

// senderStreak isn't sent — the server derives the caller's own current
// streak from their streaks row rather than trusting a client-supplied
// value (see api/social/share-score.js) — but stays in the signature since
// ShareStreakScreen.jsx calls this positionally.
export async function shareStreakWithFriend(senderId, receiverId, _senderStreak) {
  await callSocialApi('POST', 'share-score', { receiver_id: receiverId })
  invalidateFriendsDashboard()
}

// Every share involving this user, in either direction — used client-side to
// derive "shared with this friend today" and the mutual share streak per
// friend without an extra round trip per friend.
export async function getStreakSharesForUser(userId) {
  const dash = await fetchFriendsDashboard(userId)
  return dash.shares
}

// Shares received today, with sender identity — for the "shared with you
// today" list and the home-screen notification badge count.
export async function getTodaysReceivedShares(userId) {
  const dash = await fetchFriendsDashboard(userId)
  return dash.receivedToday
}

// ---------- Curriculum outlines ----------
// A shared, global cache (no user_id) — one row per subject+grade, generated
// by Claude exactly once and reused by every student forever. Session 4
// replaces the old two-call read/write pair (getCurriculumOutline, then —
// if missing — generateCurriculumOutline in ai.js, then saveCurriculumOutline)
// with a single call: /api/curriculum/get-outline does the
// check-generate-save orchestration server-side. See
// CurriculumOutlineScreen.jsx for the corresponding client change.
export async function getOrGenerateCurriculumOutline(subject, grade) {
  return callCurriculumApi('GET', `get-outline?subject=${encodeURIComponent(subject)}&grade=${encodeURIComponent(grade)}`)
}
