// Session 5: RLS is enabled on every Supabase table (see supabase/schema.sql)
// and the anon key this file used to query with directly is blocked by
// policy now — every remaining direct supabase.from() call in this file
// (auth, grades, study plans, practice sessions, progress) has moved behind
// a session-authenticated /api endpoint, the same way Sessions 3-4 already
// migrated student/parent/social/uploads/curriculum data. This file no
// longer imports the Supabase client at all — everything goes through
// callApi below. See src/lib/codes.js and src/lib/supabaseClient.js, both
// deleted this session as a result (nothing imports them anymore).
import { getUserTimeZone } from './timezone'

const SESSION_KEY = 'zyndal_session'

let sessionExpiredHandler = null
// Registered once by App.jsx so any 401 from these endpoints — not just
// the initial page-load check — redirects to the login screen immediately,
// without every calling component needing its own 401 handling.
export function setSessionExpiredHandler(fn) {
  sessionExpiredHandler = fn
}

let premiumRequiredHandler = null
// Registered once by App.jsx (mirrors setSessionExpiredHandler above) so a
// 403 PREMIUM_REQUIRED from ANY endpoint — not just the ones the UI already
// gates with its own isPremium checks — shows the upgrade modal instead of
// a raw error. This is the actual server-side enforcement's other half:
// api/_lib/subscription.js's assertPremium stops the request, this makes
// sure hitting that stop still shows a proper upgrade prompt rather than a
// confusing error toast, covering anyone who bypasses the UI gating (or a
// screen this app simply hasn't wired its own premium check into yet).
export function setPremiumRequiredHandler(fn) {
  premiumRequiredHandler = fn
}

// Exported so ai.js's callGenerateApi — a separate fetch wrapper, not this
// file's callApi, since it hits a different base path with its own auth
// header timing — can trigger the same global callback without duplicating
// the registration mechanism.
export function notifyPremiumRequired() {
  premiumRequiredHandler?.()
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

  // Prefer the longer, specific `message` over the short `error` label when
  // both are present — every endpoint using the sanitize.js validation
  // convention ({ error: 'Invalid input', field, message: '...' }) or a
  // thrown err.userMessage (e.g. api/auth/login.js's ACCOUNT_DELETED) sends
  // exactly this shape specifically so the UI shows the useful text instead
  // of a generic label. `error` alone remains the fallback for the many
  // endpoints that only ever set that one field.
  if (response.status === 401) {
    clearSession()
    sessionExpiredHandler?.()
    throw new Error(data?.message || data?.error || 'Your session has expired. Please log in again.')
  }
  if (!response.ok) {
    const err = new Error(data?.message || data?.error || `Request to ${endpoint} failed (${response.status}).`)
    // Additive — nothing reads .code today, but VerifyEmailScreen needs to
    // tell an expired token apart from an invalid one without string-
    // matching err.message.
    if (data?.code) err.code = data.code
    if (data?.code === 'PREMIUM_REQUIRED') premiumRequiredHandler?.()
    throw err
  }
  return data
}

function callAuthApi(endpoint, body) {
  return callApi('/api/auth', 'POST', endpoint, body)
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

function callQuestionsApi(method, endpoint, body) {
  return callApi('/api/questions', method, endpoint, body)
}

function callTeacherApi(method, endpoint, body) {
  return callApi('/api/teacher', method, endpoint, body)
}

function callClassesApi(method, endpoint, body) {
  return callApi('/api/classes', method, endpoint, body)
}

function callNotificationsApi(method, endpoint, body) {
  return callApi('/api/notifications', method, endpoint, body)
}

function callStripeApi(method, endpoint, body) {
  return callApi('/api/stripe', method, endpoint, body)
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
// A signed-in device holds a random session token, issued by /api/auth/login
// or /api/auth/signup into the `sessions` table and looked up (server-side,
// via X-Session-Token) on every authenticated request.

export function getSessionToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw).token : null
  } catch {
    return null
  }
}

function storeSession(token) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token }))
}

// Clears the local session immediately (so the UI can log the user out
// without waiting on a network round trip) and deletes the matching row on
// the server in the background — best-effort, since a session that merely
// expires after 30 days is an acceptable fallback if this fails.
export function clearSession() {
  const token = getSessionToken()
  localStorage.removeItem(SESSION_KEY)
  if (!token) return
  callAuthApi('logout', { token }).catch((error) => console.error('[storage] failed to delete session:', error))
}

// ---------- Auth ----------
// Session 5: login/signup necessarily run BEFORE a session token exists, so
// neither can go through the session-authenticated handlers everything else
// in this file uses — see api/auth/login.js and api/auth/signup.js, which
// now do everything findUserByUsername/findUserByParentCode/createUser/
// verifyLogin/linkParentAndStudent/createSession/generateParentCode used to
// do via direct (pre-RLS) Supabase calls from here.

export async function login(username, password) {
  const { user, token } = await callAuthApi('login', { username, password })
  storeSession(token)
  return user
}

export async function signup({ username, password, accountType, grade = null, parentCode = null }) {
  const { user, token } = await callAuthApi('signup', {
    username,
    password,
    account_type: accountType,
    grade,
    parent_code: parentCode,
  })
  storeSession(token)
  return user
}

// ---------- Password reset ----------
// Public — a signed-out visitor who forgot their password has no session,
// by definition. Mirrors the email-verification wrappers' shape/rationale.

export async function requestPasswordReset(email) {
  return callAuthApi('request-password-reset', { email })
}

export async function validateResetToken(token) {
  return callApi('/api/auth', 'GET', `validate-reset-token?token=${encodeURIComponent(token)}`)
}

export async function resetPassword(token, newPassword) {
  return callAuthApi('reset-password', { token, new_password: newPassword })
}

// Public — no session exists yet at this point in the signup flow. Called
// by SignupForm.jsx right before signup() runs; throws (via callApi) with
// code EMAIL_EXISTS if taken, same as every other endpoint's error shape.
export async function checkEmailAvailable(email) {
  return callApi('/api/auth', 'GET', `check-email?email=${encodeURIComponent(email)}`)
}

// Public — powers the "@[parent] invited you to Zyndal!" banner on the
// signup screen when arriving via a ?parent_code=... invite link, before
// any account/session exists.
export async function lookupParentCode(code) {
  return callApi('/api/auth', 'GET', `lookup-parent-code?code=${encodeURIComponent(code)}`)
}

// ---------- Social login (Google/Facebook) ----------
// See OAuthCallbackScreen.jsx / OAuthMergeScreen.jsx for the flow this
// backs. Both calls hit api/auth/oauth-callback.js and
// api/auth/oauth-merge.js — new endpoints alongside login/signup above, not
// replacements for them; username/password auth is untouched.

// provider/supabaseAccessToken are the only inputs that actually matter —
// api/auth/oauth-callback.js re-derives provider_user_id/email/name itself
// from the verified token rather than trusting anything else the client
// might send (see that file's comment), so there's nothing else to pass here.
//
// Response shape is one of:
//   { success: true, token, user, is_new_user } — logged in, session stored
//   { needs_merge: true, existing_username, provider_email, provider_name,
//     provider_user_id, provider } — no session yet, caller shows the merge screen
export async function oauthCallback({ provider, supabaseAccessToken }) {
  const data = await callAuthApi('oauth-callback', {
    provider,
    supabase_access_token: supabaseAccessToken,
  })
  if (data.token) storeSession(data.token)
  return data
}

// Same rationale as oauthCallback above — api/auth/oauth-merge.js derives
// the provider identity from supabaseAccessToken itself; existingUsername
// and existingPassword are the only client-submitted values it trusts, and
// only because they're gated behind a bcrypt check.
export async function oauthMerge({ provider, supabaseAccessToken, existingUsername, existingPassword }) {
  const data = await callAuthApi('oauth-merge', {
    provider,
    supabase_access_token: supabaseAccessToken,
    existing_username: existingUsername,
    existing_password: existingPassword,
  })
  if (data.token) storeSession(data.token)
  return data.user
}

// userId isn't sent — the server derives who's editing from the session
// token (see api/student/update-settings.js) — but stays in the signature
// since SettingsScreen.jsx calls this positionally.
export async function updateUserProfile(userId, { displayName, email, schoolName, avatar, grade, languagePreference, notificationPreferences }) {
  return callStudentApi('POST', 'update-settings', {
    display_name: displayName,
    email,
    school: schoolName,
    avatar,
    grade,
    language_preference: languagePreference,
    notification_preferences: notificationPreferences,
  })
}

// userId isn't sent — the server derives who's changing their password from
// the session token (see api/student/change-password.js) — but stays in
// the signature since SettingsScreen.jsx calls this positionally.
export async function changePassword(userId, currentPassword, newPassword) {
  await callStudentApi('POST', 'change-password', { current_password: currentPassword, new_password: newPassword })
}

// Soft delete (Quebec Law 25) — sets deleted_at server-side and purges every
// session for this account (see api/auth/delete-account.js), so the token
// this call itself used is already invalid by the time it returns; the
// caller (DeleteAccountModal → SettingsScreen) clears local session state
// and logs out regardless of this promise resolving vs. the session simply
// no longer working.
export async function deleteAccount() {
  return callAuthApi('delete-account', { confirmation: 'DELETE' })
}

// GET (unlike every other callAuthApi user, which are POST) — callApi's
// method param lets us call it directly rather than through the POST-only
// callAuthApi helper. Returns the parsed JSON payload; turning that into an
// actual browser file download is SettingsScreen.jsx's job (see
// handleExport there), since a header alone can't trigger one for a
// fetch()-based, header-authenticated request.
export async function exportMyData() {
  return callApi('/api/auth', 'GET', 'export-data')
}

// ---------- Email verification ----------

// Public (no session required — someone clicking an email link on a fresh
// device won't have one) — GET bypasses the POST-only callAuthApi wrapper
// the same way exportMyData does above. A session token still gets
// attached automatically if one happens to exist (callApi always does
// this), but api/auth/verify-email.js ignores it entirely — it's
// token-only, not session-authenticated.
//
// api/auth/verify-email.js returns a minimal user shape (id, username,
// account_type, grade, avatar) just for its own response size — if it
// also returned a session token (successful auto-login), that's swapped
// out here for a full profile via the same trusted getCurrentUser() path
// login/signup/OAuth all use, so the app's `user` state never runs on a
// partial shape the rest of the app has never had to handle.
export async function verifyEmail(token) {
  const data = await callApi('/api/auth', 'GET', `verify-email?token=${encodeURIComponent(token)}`)
  if (data.token) {
    storeSession(data.token)
    data.user = await getCurrentUser()
  }
  return data
}

export async function resendVerificationEmail() {
  return callAuthApi('resend-verification', {})
}

// Public counterpart to resendVerificationEmail above — used from the
// /verify page itself (VerifyEmailScreen.jsx) when the token has expired,
// where the visitor almost certainly has no session yet.
// api/auth/resend-expired-verification.js doesn't require or look at
// X-Session-Token either way, so this is a plain callAuthApi call like
// every other POST /api/auth/* endpoint.
export async function resendExpiredVerification(token) {
  return callAuthApi('resend-expired-verification', { token })
}

export async function getCurrentUser() {
  const token = getSessionToken()
  if (!token) return null
  try {
    return await callStudentApi('GET', 'get-profile')
  } catch {
    // callApi already clears the session (and deletes it server-side) on a
    // genuine 401 — if the token is already gone, that's what happened and
    // there's nothing left to retry. Any other failure (offline, DNS not
    // resolved yet, the network stack still spinning up) leaves the token
    // untouched, so it's worth one short retry before giving up.
    //
    // Bug fix: this used to call clearSession() unconditionally here,
    // which — for anything other than a real 401 — deleted a perfectly
    // valid session over nothing more than a transient network hiccup.
    // That's exactly what made tapping a push notification (which cold-
    // starts the app before the network/service worker stack is fully up)
    // bounce straight to the login screen: the very first get-profile call
    // would fail, and this would log the user out for real in response.
    if (!getSessionToken()) return null
    await new Promise((resolve) => setTimeout(resolve, 800))
    try {
      return await callStudentApi('GET', 'get-profile')
    } catch {
      return null
    }
  }
}

// ---------- Parent <-> student links ----------

// Session 4: reads from the shared dashboard fetch (see
// fetchParentDashboard above) instead of querying parent_student/users
// directly — stripped back down to the same shape this function always
// returned (no progress/practice/grades, which the dashboard also carries
// for other callers).
export async function getStudentsForParent(parentId) {
  const dash = await fetchParentDashboard(parentId)
  return dash.students.map(({ progress: _progress, recentPracticeSessions: _sessions, grades: _grades, ...student }) => student)
}

// ---------- Stripe subscription payments ----------

// studentId is only meaningful when a parent buys the 'student' plan (see
// api/stripe/create-checkout.js) — omitted for a self-purchase (student or
// teacher buyer) or the 'family' plan (which covers every linked student,
// resolved server-side).
export async function createCheckoutSession({ plan, studentId }) {
  return callStripeApi('POST', 'create-checkout', { plan, student_id: studentId })
}

export async function openCustomerPortal() {
  return callStripeApi('POST', 'customer-portal')
}

export async function verifySubscriptionSession(sessionId) {
  return callStripeApi('GET', `verify-session?session_id=${encodeURIComponent(sessionId)}`)
}

// ---------- Add Child (parent-initiated linking) ----------

export async function searchStudentsForParent(query) {
  return callParentApi('GET', `search-students?username=${encodeURIComponent(query)}`)
}

export async function sendParentLinkRequest(studentId) {
  const result = await callParentApi('POST', 'link-request', { student_id: studentId })
  invalidateParentDashboard()
  return result
}

export async function inviteChildByEmail(childEmail) {
  const result = await callParentApi('POST', 'invite-email', { child_email: childEmail })
  invalidateParentDashboard()
  return result
}

export function getPendingInvitationsForParent(parentId) {
  return fetchParentDashboard(parentId).then((dash) => dash.pendingInvitations || [])
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

// userId isn't sent — the server derives it from the session token (see
// api/student/get-progress.js) — but stays in the signature since
// StudentFlow.jsx calls this positionally. For a PARENT viewing a linked
// student's progress, see getStudentProgress below instead — this endpoint
// is self-only and would 403/404 a parent asking about someone else's data.
export async function getProgress(_userId) {
  return callStudentApi('GET', `get-progress?timezone=${encodeURIComponent(getUserTimeZone())}`)
}

// Drives the subject grid's per-card done/incorrect state (SubjectDashboard
// via StudentFlow.jsx) — a narrower, timezone-aware sibling of getProgress
// above rather than a client-side derivation from progress.history, so
// "today" is resolved server-side in the caller's own local timezone (see
// api/student/get-daily-progress.js) instead of trusting the browser's
// clock for something that decides the streak-safe badge.
export async function getDailyProgress() {
  return callStudentApi('GET', `get-daily-progress?timezone=${encodeURIComponent(getUserTimeZone())}`)
}

// Session 5: a parent viewing a linked student's progress/practice/grades
// (ParentDashboard, FinanceScreen) reads from the same shared dashboard
// fetch as getStudentsForParent above — get-dashboard.js already returns
// this per student (it verifies the parent<->student link server-side),
// so there's no separate endpoint needed, and no way for a parent to end up
// pulling data for a student who isn't actually theirs.
export async function getStudentProgress(parentId, studentId) {
  const dash = await fetchParentDashboard(parentId)
  return dash.students.find((s) => s.id === studentId)?.progress ?? null
}

export async function getStudentPracticeSessions(parentId, studentId) {
  const dash = await fetchParentDashboard(parentId)
  return dash.students.find((s) => s.id === studentId)?.recentPracticeSessions ?? []
}

export async function getStudentGrades(parentId, studentId) {
  const dash = await fetchParentDashboard(parentId)
  return dash.students.find((s) => s.id === studentId)?.grades ?? []
}

// StudentHome.jsx's source of "today's question" — fetched from the server
// rather than computed locally, since resolveDailyQuestion's selection (a
// generated-pool hash pick, or a grade-filtered hardcoded fallback) depends
// on server-side state (the student's own grade, the generated_questions
// pool, this month's answered questions) the client has no direct access
// to. See api/questions/get-daily-question.js.
export async function getTodayQuestion(subject, timezone = getUserTimeZone()) {
  return callQuestionsApi('GET', `get-daily-question?subject=${encodeURIComponent(subject)}&timezone=${encodeURIComponent(timezone)}`)
}

// Scratchpad is Math-only — other subjects may be added in future.
// Submits a photo of the student's handwritten work for AI grading against
// the already-scored answer (answerId, from submitAnswer's response) — see
// api/questions/grade-work.js for why question_text/correct_answer are
// never sent from here.
export async function gradeWork(answerId, imageDataUrl) {
  return callQuestionsApi('POST', 'grade-work', { mode: 'correct_work_submission', answer_id: answerId, image_base64: imageDataUrl })
}

// Reviews a WRONG Math answer's scratchpad work before anything is
// submitted — the AI looks for a genuine attempt and points out the first
// error. Nothing is scored by this call; the server derives today's
// question itself rather than trusting a client-supplied one (see
// api/questions/grade-work.js).
export async function reviewWrongAnswer(imageDataUrl, timezone = getUserTimeZone()) {
  return callQuestionsApi('POST', 'grade-work', { mode: 'wrong_answer_review', subject: 'math', image_base64: imageDataUrl, timezone })
}

// Records that a correct second attempt followed an AI-reviewed hint — for
// the parent dashboard's "correct after hint" distinction only. The XP/coin
// award itself already happened via submitAnswer's normal flow; this never
// awards anything on its own.
export async function logRetryCorrect(answerId, imageDataUrl) {
  return callQuestionsApi('POST', 'grade-work', { mode: 'retry_correct_log', answer_id: answerId, image_base64: imageDataUrl })
}

// Computes the result of answering today's question and persists both the
// new answer row and the updated streak/xp/coin totals. question and today
// aren't sent — the server looks up today's actual question itself and
// derives correctness/streak/milestones/perfect-week server-side (see
// api/student/submit-answer.js, which reuses the exact same
// applyDailyAnswer logic from src/lib/streak.js) — both params stay in the
// signature only because StudentHome.jsx calls this positionally.
export async function submitAnswer(progress, question, selectedIndex, subjectId, _today) {
  const data = await callStudentApi('POST', 'submit-answer', {
    subject: subjectId,
    selected_index: selectedIndex,
    timezone: getUserTimeZone(),
  })

  const newEntry = { ...data.entry, id: data.answer_id }
  const newProgress = {
    ...progress,
    streak: data.new_streak,
    longestStreak: data.longest_streak,
    xp: data.new_xp_total,
    coins: data.new_coins_total,
    lastCorrectDate: data.last_correct_date,
    history: [...progress.history, newEntry],
  }

  return {
    progress: newProgress,
    correct: data.correct,
    coinsEarned: data.coins_earned,
    xpEarned: data.xp_earned,
    milestoneHit: data.milestone_reached,
    bonusEarned: data.bonus_earned,
    perfectWeek: data.perfect_week_bonus_cents != null ? { bonusCents: data.perfect_week_bonus_cents } : null,
    answerId: data.answer_id,
  }
}

// Catching up on a subject that was never answered on a PAST day (the home
// screen's date-nav bar → a past date → "Answer now" — see
// StudentHome.jsx). Deliberately a
// separate endpoint/call from submitAnswer above, not the same one with a
// date override: XP only, no coins, no streak credit — see
// api/student/submit-late-answer.js's header comment. Returns just
// { correct, entry } (no progress object), since the caller updates its own
// local progress.history/xp directly rather than reconstructing a whole new
// progress object the way submitAnswer's response shape implies.
export async function submitLateAnswer({ subject, selectedIndex, date }) {
  return callStudentApi('POST', 'submit-late-answer', {
    subject,
    selected_index: selectedIndex,
    date,
    timezone: getUserTimeZone(),
  })
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
// A bonus can be triggered by either source: a graded test upload or a
// manually-logged grade — see api/uploads/save-upload.js and
// api/student/create-grade.js, which both call the (now server-side only)
// grade-bonus-creation logic right after their own insert.

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

// ---------- Payout requests (student-initiated cash-out) ----------

export async function getPendingPayoutRequests(parentId) {
  const dash = await fetchParentDashboard(parentId)
  return dash.pendingPayoutRequests
}

export async function resolvePayoutRequest(requestId, action) {
  await callParentApi('POST', 'resolve-payout-request', { request_id: requestId, action })
  invalidateParentDashboard()
}

// Student-side Wallet page — not cached like fetchParentDashboard/
// fetchFriendsDashboard, since it's only ever read from the one Wallet
// screen rather than sliced across several components.
export async function getStudentWallet() {
  return callStudentApi('GET', 'get-wallet')
}

export async function requestPayout(coinAmount, note) {
  return callStudentApi('POST', 'request-payout', { coin_amount: coinAmount, note })
}

// ---------- Document uploads ----------
// Session 4: saveUpload/addPagesToUpload compose two endpoints (save-upload,
// save-questions) instead of inserting into uploads/upload_questions
// directly. The grade-bonus check that used to run here after saveUpload's
// insert runs server-side, in api/uploads/save-upload.js's handler.

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
// userId stays in both signatures below since GradesScreen.jsx/
// LogGradeModal.jsx call them positionally — the server derives the actual
// caller from the session token (see api/student/create-grade.js and
// api/student/get-grades.js). For a parent viewing a linked student's
// grades, see getStudentGrades above instead.

export async function createGrade({ userId: _userId, subject, testName, gradePercentage, testDate, notes }) {
  return callStudentApi('POST', 'create-grade', { subject, test_name: testName, grade_percentage: gradePercentage, test_date: testDate, notes })
}

export async function getGradesForUser(_userId) {
  const data = await callStudentApi('GET', 'get-grades')
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

// userId stays in every signature below since TestPrepSetupScreen.jsx/
// StudyPlanScreen.jsx/StudentFlow.jsx call these positionally — the server
// derives the actual caller from the session token, and verifies ownership
// on every plan_id-scoped mutation (see api/student/update-study-plan.js).
export async function createStudyPlan({ userId: _userId, subject, topic, testDate, daysAvailable, gradeLevel, planData }) {
  return callStudentApi('POST', 'create-study-plan', {
    subject,
    topic,
    test_date: testDate,
    days_available: daysAvailable,
    grade_level: gradeLevel,
    plan_data: planData,
  })
}

// The most recent active plan whose test hasn't passed yet.
export async function getActiveStudyPlan(_userId) {
  return callStudentApi('GET', 'get-active-study-plan')
}

export async function updateStudyPlanData(planId, planData) {
  await callStudentApi('POST', 'update-study-plan', { plan_id: planId, plan_data: planData })
}

export async function completeStudyPlan(planId) {
  await callStudentApi('POST', 'update-study-plan', { plan_id: planId, status: 'completed' })
}

export async function cancelStudyPlan(planId) {
  await callStudentApi('POST', 'update-study-plan', { plan_id: planId, status: 'cancelled' })
}

// Completed and cancelled plans, most recent test first — for the Past
// Plans section. Plans that simply expired without being marked either way
// are not included (they're still technically 'active', just past their
// test date, and quietly stop showing on the home screen on their own).
export async function getPastStudyPlans(_userId) {
  const data = await callStudentApi('GET', 'get-past-study-plans')
  return data || []
}

export async function getActiveStudyPlansForParent(parentId) {
  const dash = await fetchParentDashboard(parentId)
  return dash.studyPlans
}

// ---------- Practice ----------
// Unlike Test Prep/Study Guide, Practice sessions do award coins (never XP —
// XP stays exclusive to the daily question). Session 5: the per-question
// live coin award (awardCoins) is gone — see api/student/save-practice-
// session.js's header comment for why that could never be made authoritative
// under RLS, and PracticeSessionScreen.jsx for the corresponding UI change
// (coins now land all at once when the session is saved, not per-question).

export async function savePracticeSession({ userId: _userId, subject, topic, questionsCorrect, questionsTotal }) {
  return callStudentApi('POST', 'save-practice-session', {
    subject,
    topic,
    questions_correct: questionsCorrect,
    questions_total: questionsTotal,
  })
}

export async function getRecentPracticeSessions(_userId, limit = 5) {
  const data = await callStudentApi('GET', `get-practice-sessions?limit=${limit}`)
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
  const result = await callSocialApi('POST', 'share-score', { receiver_id: receiverId, timezone: getUserTimeZone() })
  invalidateFriendsDashboard()
  return result
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

// ---------- Notifications ----------
// Unlike getTodaysReceivedShares above (which reads from the cached
// friends-dashboard fetch and includes every share regardless of seen_at,
// feeding ShareStreakScreen's unrelated "start a streak" nudge),
// getIncomingShares is a plain uncached call scoped to unseen shares only —
// backs the home-screen notification box and the Friends screen's badge.
// Call volume doesn't warrant a cache layer here.
export async function getIncomingShares() {
  return callSocialApi('GET', `get-incoming-shares?timezone=${encodeURIComponent(getUserTimeZone())}`)
}

export async function markShareSeen(shareId) {
  return callNotificationsApi('POST', 'mark-share-seen', { share_id: shareId })
}

export async function getNotifications() {
  return callNotificationsApi('GET', 'get-notifications')
}

export async function markNotificationRead(notificationId) {
  return callNotificationsApi('POST', 'mark-read', { notification_id: notificationId })
}

export async function markAllNotificationsRead() {
  return callNotificationsApi('POST', 'mark-read', { mark_all: true })
}

export async function subscribeToPushNotifications(subscription) {
  return callNotificationsApi('POST', 'subscribe', { subscription })
}

// ---------- Curriculum outlines ----------
// A shared, global cache (no user_id) — one row per subject+grade, generated
// by Claude exactly once and reused by every student forever. Session 4
// replaced the old two-call read/write pair with a single call:
// /api/curriculum/get-outline does the check-generate-save orchestration
// server-side. See CurriculumOutlineScreen.jsx for the corresponding client
// change.
export async function getOrGenerateCurriculumOutline(subject, grade) {
  return callCurriculumApi('GET', `get-outline?subject=${encodeURIComponent(subject)}&grade=${encodeURIComponent(grade)}`)
}

// ---------- Parent linking (student side) ----------

export async function linkParentByCode(parentCode) {
  return callStudentApi('POST', 'link-parent', { parent_code: parentCode })
}

export async function getPendingParentRequests() {
  return callStudentApi('GET', 'get-pending-parent-requests')
}

export async function respondToParentLinkRequest(invitationId, accept) {
  return callStudentApi('POST', 'respond-parent-link', { invitation_id: invitationId, action: accept ? 'accept' : 'decline' })
}

// ---------- Classes (student side) ----------

export async function getMyClasses() {
  return callStudentApi('GET', 'get-my-classes')
}

export async function joinClass(teacherCode) {
  return callStudentApi('POST', 'join-class', { teacher_code: teacherCode })
}

// ---------- Homework (student side) ----------

export async function getMyHomework() {
  return callStudentApi('GET', `get-homework?timezone=${encodeURIComponent(getUserTimeZone())}`)
}

// Scratchpad is Math-only — other subjects may be added in future.
// workImages (optional): { questionIndex: canvas.toDataURL() } — only
// meaningful for Math assignments, ignored server-side otherwise.
export async function submitHomework(assignmentId, selectedIndexes, workImages) {
  return callStudentApi('POST', 'submit-homework', {
    assignment_id: assignmentId,
    selected_indexes: selectedIndexes,
    timezone: getUserTimeZone(),
    ...(workImages && Object.keys(workImages).length > 0 ? { work_images: workImages } : {}),
  })
}

export async function getHomeworkSubmission(assignmentId) {
  return callStudentApi('GET', `get-homework-submission?assignment_id=${encodeURIComponent(assignmentId)}`)
}

// ---------- Classes (student side, with current unit + calendar) ----------

export async function getStudentClasses() {
  return callClassesApi('GET', 'get-student-classes')
}

export async function getClassHomeworkCalendar(classId, month, year) {
  const params = new URLSearchParams({
    class_id: classId,
    month: String(month),
    year: String(year),
    timezone: getUserTimeZone(),
  })
  return callClassesApi('GET', `get-class-homework-calendar?${params.toString()}`)
}

// ---------- Teacher: stats ----------

export async function getTeacherStats() {
  return callTeacherApi('GET', 'get-stats')
}

export async function getRecentHomework() {
  return callTeacherApi('GET', 'get-recent-homework')
}

// ---------- Teacher: classes ----------

export async function getTeacherClasses() {
  return callTeacherApi('GET', 'get-classes')
}

export async function createClass({ name, grade, school }) {
  return callTeacherApi('POST', 'create-class', { name, grade, school })
}

export async function getClassDetail(classId) {
  return callTeacherApi('GET', `get-class-detail?class_id=${encodeURIComponent(classId)}`)
}

export async function setCurrentUnit(classId, unitNumber, unitTitle) {
  return callTeacherApi('POST', 'set-current-unit', {
    class_id: classId,
    current_unit_number: unitNumber,
    current_unit_title: unitTitle,
  })
}

export async function getSubmissionDetail(assignmentId, studentId) {
  return callTeacherApi(
    'GET',
    `get-submission-detail?assignment_id=${encodeURIComponent(assignmentId)}&student_id=${encodeURIComponent(studentId)}`
  )
}

// Scratchpad is Math-only — other subjects may be added in future.
export async function reviewWork(workSubmissionId, approved) {
  return callTeacherApi('POST', 'review-work', { work_submission_id: workSubmissionId, approved })
}

// ---------- Teacher: homework ----------

export async function getBankQuestions({ subject, grade, randomCount }) {
  const params = new URLSearchParams({ subject, grade: String(grade) })
  if (randomCount) params.set('random_count', String(randomCount))
  return callTeacherApi('GET', `get-bank-questions?${params.toString()}`)
}

export async function createHomework({ title, subject, dueDate, classIds, questions }) {
  return callTeacherApi('POST', 'create-homework', {
    title,
    subject,
    due_date: dueDate,
    class_ids: classIds,
    questions,
  })
}

// ---------- Teacher: leaderboard ----------

export async function getTeacherLeaderboard(classId) {
  return callTeacherApi('GET', `get-leaderboard${classId ? `?class_id=${encodeURIComponent(classId)}` : ''}`)
}

