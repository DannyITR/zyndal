import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { generateUniqueParentCode, SAFE_USER_COLUMNS } from '../_lib/db.js'
import { sanitizeString, sanitizeEmail, sanitizeGrade, sanitizeAccountType } from '../_lib/sanitize.js'
import { createAndSendVerificationEmail } from '../_lib/verification.js'

const LANGUAGE_PREFERENCES = new Set(['English', 'French', 'Spanish'])
// Deliberately duplicated from THEMES in src/lib/theme.js rather than
// imported — that file's own bottom-of-file bootstrap line touches
// document/localStorage as an import side effect (see its header comment),
// which would crash this serverless function the moment it's imported, the
// same browser-only-dependency hazard src/lib/streak.js's own header
// comment warns about. Same reasoning as LANGUAGE_PREFERENCES just above.
const THEME_PREFERENCES = new Set(['default', 'midnight', 'daylight'])
const NOTIFICATION_PREFERENCE_KEYS = ['enabled', 'score_share', 'friend_request', 'streak_reminder']

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

  // The structured schools-table reference (see schools/school_subject_groups)
  // — distinct from the free-text `school` column above, which stays as the
  // "Other/not listed" fallback. Existence and the one-time-set rule are
  // checked in handle() (needs a DB round trip); this just guards the shape.
  if (body.school_id !== undefined && body.school_id !== null && (typeof body.school_id !== 'string' || !body.school_id.trim())) {
    return { field: 'school_id', message: 'school_id must be a valid school id.' }
  }

  if (body.grade !== undefined && body.grade !== null && body.grade !== '') {
    const grade = sanitizeGrade(body.grade)
    if (grade === null) return { field: 'grade', message: 'grade must be 7, 8, 9, 10, or 11.' }
    body.grade = grade
  }

  if (body.language_preference !== undefined && body.language_preference !== null && !LANGUAGE_PREFERENCES.has(body.language_preference)) {
    return { field: 'language_preference', message: "language_preference must be 'English', 'French', or 'Spanish'." }
  }

  // Cosmetic-only, unlike language/grade above — sent by every account type
  // (SettingsScreen.jsx's theme picker isn't gated behind isStudent).
  if (body.theme_preference !== undefined && body.theme_preference !== null && !THEME_PREFERENCES.has(body.theme_preference)) {
    return { field: 'theme_preference', message: "theme_preference must be 'default', 'midnight', or 'daylight'." }
  }

  if (body.notification_preferences !== undefined && body.notification_preferences !== null) {
    const prefs = body.notification_preferences
    if (typeof prefs !== 'object' || Array.isArray(prefs)) {
      return { field: 'notification_preferences', message: 'notification_preferences must be an object.' }
    }
    for (const key of NOTIFICATION_PREFERENCE_KEYS) {
      if (prefs[key] !== undefined && typeof prefs[key] !== 'boolean') {
        return { field: 'notification_preferences', message: `notification_preferences.${key} must be a boolean.` }
      }
    }
  }

  // Only meaningful right after a social-login signup (see
  // OAuthOnboardingScreen.jsx) — api/auth/oauth-callback.js always creates
  // new accounts as 'student', and onboarding lets the person say "actually
  // I'm a parent" or "actually I'm a teacher" before ever reaching the app.
  // Not exposed anywhere in the regular Settings UI (SettingsScreen.jsx
  // never sends this field), so an established account switching its own
  // account_type on a whim isn't a flow this endpoint is meant to serve —
  // just one it doesn't prevent.
  if (body.account_type !== undefined && body.account_type !== null) {
    const accountType = sanitizeAccountType(body.account_type)
    if (!accountType) {
      return { field: 'account_type', message: "account_type must be 'student', 'parent', or 'teacher'." }
    }
    body.account_type = accountType
  }

  return null
}

async function handle({ userId, body }) {
  const { display_name, email, school, school_id, avatar, grade, language_preference, theme_preference, notification_preferences, account_type: accountType } = body

  // Partial update: only a field the caller actually sent gets written —
  // e.g. updateThemePreference() sends just { theme_preference } and must
  // leave display_name/email/school/etc. exactly as they are. (undefined
  // means "not sent"; an explicit '' still clears the field via the
  // `|| null` fallback, matching validate()'s documented semantics above.)
  const updates = {}
  if (display_name !== undefined) updates.display_name = display_name || null
  if (school !== undefined) updates.school = school || null
  if (avatar !== undefined) updates.avatar = avatar || null
  if (grade !== undefined) updates.grade = grade ?? null
  if (language_preference !== undefined) updates.language_preference = language_preference
  if (theme_preference !== undefined) updates.theme_preference = theme_preference
  if (notification_preferences !== undefined) updates.notification_preferences = notification_preferences

  // One pre-fetch covers the existing parent-code lookup, the email-change
  // check below, and the school_id one-time-set check further down.
  const { data: current, error: currentError } = await supabase.from('users').select('parent_code, email, school_id').eq('id', userId).maybeSingle()
  if (currentError) throw currentError

  // A changed email hasn't been proven to belong to this user yet, even if
  // the account was previously OAuth-verified (api/auth/oauth-callback.js)
  // or already verified a *different* email — re-verify from scratch. Only
  // evaluated when email was actually part of this request — see the
  // partial-update comment above.
  const emailChanged = email !== undefined && (email || null) !== (current?.email || null)
  if (emailChanged) {
    updates.email = email || null
    updates.email_verified = false
  }

  // Authoritative duplicate-email guard — api/auth/check-email.js is only
  // a pre-check SignupForm.jsx calls before signup() runs, which can't
  // catch a race against another signup, and doesn't cover this endpoint's
  // other caller (SettingsScreen.jsx's own "change your email" field).
  if (emailChanged && updates.email) {
    const { data: emailOwner, error: emailOwnerError } = await supabase
      .from('users')
      .select('id')
      .ilike('email', updates.email)
      .neq('id', userId)
      .maybeSingle()
    if (emailOwnerError) throw emailOwnerError
    if (emailOwner) {
      const err = new Error('Email already registered')
      err.status = 400
      err.code = 'EMAIL_EXISTS'
      err.userMessage = 'An account with this email already exists. Try logging in instead.'
      throw err
    }
  }

  // The structured school reference can only ever be SET here, not changed —
  // once school_id is non-null, changing schools requires proof + admin
  // review (school_change_requests), not a plain profile save. The client
  // only ever sends school_id while its picker is showing (i.e. while
  // school_id is still null), so hitting this with one already set means a
  // stale or forged request, not a normal flow.
  if (school_id !== undefined && school_id !== null) {
    if (current?.school_id) {
      const err = new Error('School is already set — changing it requires a review request.')
      err.status = 400
      err.code = 'SCHOOL_ALREADY_SET'
      throw err
    }
    const { data: schoolRow, error: schoolError } = await supabase.from('schools').select('id').eq('id', school_id).maybeSingle()
    if (schoolError) throw schoolError
    if (!schoolRow) {
      const err = new Error('Unknown school.')
      err.status = 400
      err.code = 'VALIDATION_ERROR'
      throw err
    }
    updates.school_id = school_id
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
  } else if (accountType === 'teacher') {
    // No teacher-side equivalent of parent_code needed here — a teacher's
    // join code is generated per-class (generateUniqueTeacherCode(), see
    // api/teacher/create-class.js), not once per account.
    updates.account_type = 'teacher'
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
