import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'
import { hashPassword } from '../../src/lib/password.js'

function validate(body) {
  if (!body.token || typeof body.token !== 'string') return 'token is required.'
  if (!body.new_password || typeof body.new_password !== 'string' || body.new_password.length < 4) {
    return { field: 'new_password', message: 'Password must be at least 4 characters.' }
  }
  return null
}

async function handle({ body }) {
  const { data: row, error } = await supabase
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token', body.token)
    .maybeSingle()
  if (error) throw error

  if (!row || row.used_at) {
    // An already-used token folds into the same "invalid" bucket as a
    // not-found one — ResetPasswordScreen.jsx only ever branches on
    // valid vs. not, per the spec's two-state UI (item 6).
    const err = new Error('Invalid reset link.')
    err.status = 400
    err.code = 'INVALID_TOKEN'
    throw err
  }

  if (new Date(row.expires_at) < new Date()) {
    const err = new Error('This reset link has expired.')
    err.status = 400
    err.code = 'EXPIRED_TOKEN'
    throw err
  }

  const hashed = await hashPassword(body.new_password)
  const { error: updateError } = await supabase.from('users').update({ password: hashed }).eq('id', row.user_id)
  if (updateError) throw updateError

  const { error: usedError } = await supabase.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id)
  if (usedError) throw usedError

  // Log out every device — a password reset means the old one may have
  // been compromised, so any session created under it shouldn't survive.
  const { error: sessionsError } = await supabase.from('sessions').delete().eq('user_id', row.user_id)
  if (sessionsError) throw sessionsError

  return { success: true }
}

export default createPublicHandler({ method: 'POST', validate, handle })
