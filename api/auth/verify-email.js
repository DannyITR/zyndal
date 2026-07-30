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

  // Auto-login is a bonus on top of verification, not a requirement for
  // it — the person already proved control of their account by having
  // this token, so a failure here (session insert, profile fetch) must
  // never turn an otherwise-successful verification into an error
  // response. token/user are simply absent if this fails; the client
  // falls back to a manual "Log In" prompt (see VerifyEmailScreen.jsx).
  const result = { success: true }
  try {
    const token = crypto.randomUUID()
    const { error: sessionError } = await supabase.from('sessions').insert({ user_id: row.user_id, token })
    if (sessionError) throw sessionError

    const { data: user, error: userFetchError } = await supabase
      .from('users')
      .select('id, username, account_type, grade, avatar')
      .eq('id', row.user_id)
      .maybeSingle()
    if (userFetchError) throw userFetchError

    result.token = token
    result.user = user
  } catch (err) {
    console.error('[verify-email] auto-login failed:', err)
  }

  return result
}

export default createPublicHandler({ method: 'GET', validate, handle })
