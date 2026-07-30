import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { generateUniqueParentCode, SAFE_USER_COLUMNS } from '../_lib/db.js'
import { sanitizeString, sanitizeEmail, sanitizeGrade, sanitizeAccountType } from '../_lib/sanitize.js'
import { createAndSendVerificationEmail } from '../_lib/verification.js'

const LANGUAGE_PREFERENCES = new Set(['English', 'French'])

// Backs updateUserProfile() in src/lib/storage.js. grade and
// language_preference are only meaningful for students, but this endpoint
// (like updateUserProfile itself) doesn't need to branch on account_type —
// the caller (SettingsScreen.jsx) already only sends them for students. An
// empty string for display_name/email/school still means "clear this
// field" (matches the `field || null` in handle() below) — sanitization
// only kicks in for a non-empty value, so clearing a field never fails
// validation just because '' isn't a valid email/name.
function validate(body) {
  if (body.display_name !== undefined && body.display_name !== null && body.display_name !== '') {
    const displayName = sanitizeString(body.display_name, 50)
    if (!displayName) return { field: 'display_name', message: 'display_name must be 1-50 characters.' }
    body.display_name = displayName
  }

  if (body.email !== undefined && body.email !== null && body.email !== '') {
    const email = sanitizeEmail(body.email)
    if (!email) return { field: 'email', message: 'email must be a valid email address.' }
    body.email = email
  }

  if (body.school !== undefined && body.school !== null && body.school !== '') {
    const school = sanitizeString(body.school, 100)
    if (!school) return { field: 'school', message: 'school must be 1-100 characters.' }
    body.school = school
  }

  if (body.grade !== undefined && body.grade !== null && body.grade !== '') {
    const grade = sanitizeGrade(body.grade)
    if (grade === null) return { field: 'grade', message: 'grade must be 7, 8, 9, 10, or 11.' }
    body.grade = grade
  }

  if (body.language_preference !== undefined && body.language_preference !== null && !LANGUAGE_PREFERENCES.has(body.language_preference)) {
    return { field: 'language_preference', message: "language_preference must be 'English' or 'French'." }
  }

  // Only meaningful right after a social-login signup (see
  // OAuthOnboardingScreen.jsx) — api/auth/oauth-callback.js always creates
  // new accounts as 'student', and onboarding lets the person say "actually
  // I'm a parent" before ever reaching the app. Not exposed anywhere in the
  // regular Settings UI (SettingsScreen.jsx never sends this field), so an
  // established account switching its own account_type on a whim isn't a
  // flow this endpoint is meant to serve — just one it doesn't prevent.
  if (body.account_type !== undefined && body.account_type !== null) {
    const accountType = sanitizeAccountType(body.account_type)
    if (!accountType) {
      return { field: 'account_type', message: "account_type must be 'student' or 'parent'." }
    }
    body.account_type = accountType
  }

  return null
}

async function handle({ userId, body }) {
  const { display_name, email, school, avatar, grade, language_preference, account_type: accountType } = body

  const updates = {
    display_name: display_name || null,
    email: email || null,
    school: school || null,
    avatar: avatar || null,
    grade: grade ?? null,
    language_preference,
  }

  // One pre-fetch covers both the existing parent-code lookup and the new
  // email-change check below, instead of two separate queries.
  const { data: current, error: currentError } = await supabase.from('users').select('parent_code, email').eq('id', userId).maybeSingle()
  if (currentError) throw currentError

  // A changed email hasn't been proven to belong to this user yet, even if
  // the account was previously OAuth-verified (api/auth/oauth-callback.js)
  // or already verified a *different* email — re-verify from scratch.
  const emailChanged = (updates.email || null) !== (current?.email || null)
  if (emailChanged) {
    updates.email_verified = false
  }

  // A brand-new OAuth-onboarding parent needs a parent_code the moment they
  // become a parent, or every parent-linking feature (StudentCard, the
  // signup parent-code field, ParentDashboard) silently has nothing to show
  // them. Only generated once — an existing parent_code from before is left
  // alone.
  if (accountType === 'parent') {
    updates.account_type = 'parent'
    if (!current?.parent_code) {
      updates.parent_code = await generateUniqueParentCode()
    }
  } else if (accountType === 'student') {
    updates.account_type = 'student'
  }

  const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select(SAFE_USER_COLUMNS).single()
  if (error) throw error

  if (emailChanged && updates.email) {
    // Awaited (matches insertNotification call sites elsewhere) — a
    // serverless function's event loop can freeze right after the response
    // is sent, so a true fire-and-forget call risks never actually running.
    // createAndSendVerificationEmail is itself best-effort/non-throwing, so
    // this still can't fail the settings save.
    await createAndSendVerificationEmail({ userId, email: updates.email, languagePreference: data.language_preference })
  }

  return data
}

export default createStudentHandler({ method: 'POST', validate, handle })
