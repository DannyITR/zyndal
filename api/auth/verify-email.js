import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'

// Public GET — someone clicking an email link has no session on this
// device, so this mirrors login.js/signup.js's use of createPublicHandler
// rather than requiring auth.
function validate(body) {
  if (!body.token || typeof body.token !== 'string') return 'token is required.'
  return null
}

async function handle({ body }) {
  const { data: row, error } = await supabase
    .from('email_verifications')
    .select('id, user_id, expires_at, verified_at')
    .eq('token', body.token)
    .maybeSingle()
  if (error) throw error

  if (!row) {
    const err = new Error('Invalid verification link.')
    err.code = 'INVALID_TOKEN'
    err.status = 400
    throw err
  }

  if (new Date(row.expires_at) < new Date()) {
    const err = new Error('This verification link has expired.')
    err.code = 'EXPIRED_TOKEN'
    err.status = 400
    throw err
  }

  // Re-clicking an already-verified link is a harmless no-op, not an error.
  if (!row.verified_at) {
    const { error: verifyError } = await supabase
      .from('email_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', row.id)
    if (verifyError) throw verifyError

    const { error: userError } = await supabase.from('users').update({ email_verified: true }).eq('id', row.user_id)
    if (userError) throw userError
  }

  return { success: true }
}

export default createPublicHandler({ method: 'GET', validate, handle })
