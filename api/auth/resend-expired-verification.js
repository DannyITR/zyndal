import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'
import { resendVerificationForUser } from '../_lib/verification.js'

// Public counterpart to api/auth/resend-verification.js — someone clicking
// an expired verification link almost certainly has no session on that
// device (fresh signup, different device, or a browser that never had
// one), so this can't require auth the way the in-app "Resend email"
// banner does. Trusts possession of the (expired) token itself as proof —
// the same trust level api/auth/verify-email.js already uses to mark an
// email verified and log someone in, so this isn't a weaker bar than what
// already exists. Token IDs are unguessable UUIDs, and this only ever
// re-sends to the exact email already on file for that token — it can't
// be used to spam an attacker-chosen address.
function validate(body) {
  if (!body.token || typeof body.token !== 'string') return 'token is required.'
  return null
}

async function handle({ body }) {
  const { data: row, error } = await supabase.from('email_verifications').select('user_id').eq('token', body.token).maybeSingle()
  if (error) throw error

  if (!row) {
    const err = new Error('Invalid verification link.')
    err.code = 'INVALID_TOKEN'
    err.status = 400
    throw err
  }

  await resendVerificationForUser(row.user_id)
  return { success: true }
}

export default createPublicHandler({ method: 'POST', validate, handle })
