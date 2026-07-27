import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeString, sanitizeEmail, sanitizeGrade } from '../_lib/sanitize.js'

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
    if (grade === null) return { field: 'grade', message: 'grade must be 9, 10, or 11.' }
    body.grade = grade
  }

  if (body.language_preference !== undefined && body.language_preference !== null && !LANGUAGE_PREFERENCES.has(body.language_preference)) {
    return { field: 'language_preference', message: "language_preference must be 'English' or 'French'." }
  }

  return null
}

async function handle({ userId, body }) {
  const { display_name, email, school, avatar, grade, language_preference } = body
  const { data, error } = await supabase
    .from('users')
    .update({
      display_name: display_name || null,
      email: email || null,
      school: school || null,
      avatar: avatar || null,
      grade: grade ?? null,
      language_preference,
    })
    .eq('id', userId)
    .select(
      'id, username, account_type, grade, parent_code, created_at, display_name, email, school, avatar, wallet_balance_cents, total_added_cents, total_paid_out_cents, coin_to_dollar_rate, milestone_settings, is_premium, language_preference'
    )
    .single()
  if (error) throw error
  return data
}

export default createStudentHandler({ method: 'POST', validate, handle })
