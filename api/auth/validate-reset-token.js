import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'

function validate(body) {
  if (!body.token || typeof body.token !== 'string') return 'token is required.'
  return null
}

// Deliberately returns { valid, ... } with a 200 for every outcome
// (not-found/expired/used) instead of throwing, unlike almost every other
// endpoint in this app — matches the exact shape requested, and this is a
// read-only check a page can safely re-run (e.g. on mount) without any
// error-shaped side effects. Does not consume the token; only
// api/auth/reset-password.js sets used_at.
async function handle({ body }) {
  const { data: row, error } = await supabase
    .from('password_reset_tokens')
    .select('user_id, expires_at, used_at')
    .eq('token', body.token)
    .maybeSingle()
  if (error) throw error

  if (!row) return { valid: false, reason: 'not_found' }
  if (row.used_at) return { valid: false, reason: 'used' }
  if (new Date(row.expires_at) < new Date()) return { valid: false, reason: 'expired' }

  const { data: user, error: userError } = await supabase.from('users').select('username').eq('id', row.user_id).maybeSingle()
  if (userError) throw userError

  return { valid: true, username: user?.username }
}

export default createPublicHandler({ method: 'GET', validate, handle })
