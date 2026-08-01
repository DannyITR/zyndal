import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { hashPassword } from '../../src/lib/password.js'

function validate(body) {
  const userId = sanitizeUuid(body.user_id)
  if (!userId) return { field: 'user_id', message: 'A valid user_id is required.' }
  body.user_id = userId

  if (!body.new_password || typeof body.new_password !== 'string' || body.new_password.length < 4) {
    return { field: 'new_password', message: 'new_password is required and must be at least 4 characters.' }
  }
  return null
}

async function handle({ body }) {
  const hashed = await hashPassword(body.new_password)
  const { data, error } = await supabase.from('users').update({ password: hashed }).eq('id', body.user_id).select('id').maybeSingle()
  if (error) throw error
  if (!data) {
    const err = new Error('User not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  // Force re-login everywhere — matches api/auth/reset-password.js's own
  // behavior for a self-service reset, so an admin-forced password change
  // can't leave an already-open session usable with the old credentials.
  const { error: sessionError } = await supabase.from('sessions').delete().eq('user_id', body.user_id)
  if (sessionError) throw sessionError

  return { success: true }
}

export default createAdminHandler({ method: 'POST', validate, handle })
