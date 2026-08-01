import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeGrade, sanitizeAccountType } from '../_lib/sanitize.js'

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

  if (body.is_premium !== undefined && typeof body.is_premium !== 'boolean') {
    return { field: 'is_premium', message: 'is_premium must be true or false.' }
  }

  if (body.deleted_at !== undefined && body.deleted_at !== null) {
    return { field: 'deleted_at', message: 'This endpoint can only clear deleted_at (restore). Use delete-user to delete an account.' }
  }

  return null
}

async function handle({ body }) {
  const updates = {}
  if (body.is_premium !== undefined) updates.is_premium = body.is_premium
  if (body.grade !== undefined) updates.grade = body.grade
  if (body.account_type !== undefined) updates.account_type = body.account_type
  if (body.deleted_at === null) updates.deleted_at = null

  if (Object.keys(updates).length === 0) {
    const err = new Error('No fields to update.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', body.user_id)
    .select('id, username, account_type, grade, is_premium, deleted_at')
    .maybeSingle()
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
