import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeGrade, sanitizeAccountType, sanitizeUsername, sanitizeString, sanitizeEmail } from '../_lib/sanitize.js'
import { AVATARS } from '../../src/lib/avatars.js'

const LANGUAGE_PREFERENCES = new Set(['English', 'French', 'Spanish'])

// Same column set get-user-detail.js selects (everything the Edit User page
// needs to re-sync its local state after a save), not db.js's
// SAFE_USER_COLUMNS — that one is scoped to what a regular user may see
// about their OWN row and omits deleted_at, which the admin page needs.
const RETURN_COLUMNS =
  'id, username, account_type, grade, parent_code, created_at, display_name, email, school, avatar, ' +
  'wallet_balance_cents, total_added_cents, total_paid_out_cents, coin_to_dollar_rate, is_premium, ' +
  'email_verified, deleted_at, timezone, language_preference'

// deleted_at is accepted here only as `null` (restore) — actually deleting
// an account (soft or hard) always goes through delete-user.js, which
// requires the explicit { confirm: "DELETE" } field. Keeping that
// destructive path in one place, gated by its own confirmation, rather than
// letting a stray deleted_at timestamp slip through this general-purpose
// update endpoint.
function validate(body) {
  const userId = sanitizeUuid(body.user_id)
  if (!userId) return { field: 'user_id', message: 'A valid user_id is required.' }
  body.user_id = userId

  if (body.username !== undefined) {
    const username = sanitizeUsername(body.username)
    if (!username) return { field: 'username', message: 'username must be 3-20 characters — letters, numbers, and underscores only.' }
    body.username = username
  }

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

  if (body.grade !== undefined && body.grade !== null) {
    const grade = sanitizeGrade(body.grade)
    if (!grade) return { field: 'grade', message: 'Grade must be between 7 and 11.' }
    body.grade = grade
  }

  if (body.account_type !== undefined) {
    const accountType = sanitizeAccountType(body.account_type)
    if (!accountType) return { field: 'account_type', message: 'Invalid account type.' }
    body.account_type = accountType
  }

  if (body.language_preference !== undefined && body.language_preference !== null && !LANGUAGE_PREFERENCES.has(body.language_preference)) {
    return { field: 'language_preference', message: "language_preference must be 'English', 'French', or 'Spanish'." }
  }

  if (body.avatar !== undefined && body.avatar !== null && body.avatar !== '' && !AVATARS.includes(body.avatar)) {
    return { field: 'avatar', message: 'Invalid avatar.' }
  }

  if (body.is_premium !== undefined && typeof body.is_premium !== 'boolean') {
    return { field: 'is_premium', message: 'is_premium must be true or false.' }
  }

  if (body.email_verified !== undefined && typeof body.email_verified !== 'boolean') {
    return { field: 'email_verified', message: 'email_verified must be true or false.' }
  }

  if (body.deleted_at !== undefined && body.deleted_at !== null) {
    return { field: 'deleted_at', message: 'This endpoint can only clear deleted_at (restore). Use delete-user to delete an account.' }
  }

  return null
}

async function handle({ body }) {
  const updates = {}
  if (body.username !== undefined) updates.username = body.username
  if (body.display_name !== undefined) updates.display_name = body.display_name || null
  if (body.email !== undefined) updates.email = body.email || null
  if (body.school !== undefined) updates.school = body.school || null
  if (body.grade !== undefined) updates.grade = body.grade
  if (body.account_type !== undefined) updates.account_type = body.account_type
  if (body.language_preference !== undefined) updates.language_preference = body.language_preference
  if (body.avatar !== undefined) updates.avatar = body.avatar || null
  if (body.is_premium !== undefined) updates.is_premium = body.is_premium
  if (body.email_verified !== undefined) updates.email_verified = body.email_verified
  if (body.deleted_at === null) updates.deleted_at = null

  if (Object.keys(updates).length === 0) {
    const err = new Error('No fields to update.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  // Pre-checked (not just left to the DB's own unique constraints) so a
  // collision comes back as a normal { field, message } validation error
  // instead of a raw 500 from an unhandled 23505 unique-violation.
  if (updates.username) {
    const { data: existing, error: existingError } = await supabase
      .from('users')
      .select('id')
      .ilike('username', updates.username)
      .neq('id', body.user_id)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) {
      const err = new Error('Username already taken.')
      err.status = 400
      err.code = 'USERNAME_TAKEN'
      throw err
    }
  }

  if (updates.email) {
    const { data: existing, error: existingError } = await supabase
      .from('users')
      .select('id')
      .ilike('email', updates.email)
      .neq('id', body.user_id)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) {
      const err = new Error('Email already registered to another account.')
      err.status = 400
      err.code = 'EMAIL_EXISTS'
      throw err
    }
  }

  const { data, error } = await supabase.from('users').update(updates).eq('id', body.user_id).select(RETURN_COLUMNS).maybeSingle()
  if (error) throw error
  if (!data) {
    const err = new Error('User not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  return { user: data }
}

export default createAdminHandler({ method: 'POST', validate, handle })
