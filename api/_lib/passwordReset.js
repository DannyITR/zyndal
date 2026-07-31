import { supabase } from './auth.js'
import { sendPasswordResetEmail } from './resend.js'

const MAX_PER_HOUR = 3
const HOUR_MS = 60 * 60 * 1000

// Called by api/auth/request-password-reset.js, which always returns the
// same { success: true } regardless of what happens in here — "no such
// email," "rate limited," and "actually sent" all look identical from the
// outside. That's deliberate: this endpoint is reachable by anyone with
// just an email address, so a distinguishable rate-limit response would
// itself be an enumeration side-channel (spam a candidate address 4
// times; a real account would 429 on the 4th, a fake one wouldn't).
export async function requestPasswordResetForEmail(email) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, language_preference')
    .ilike('email', email)
    .is('deleted_at', null)
    .maybeSingle()
  if (userError) {
    console.error('[password-reset] lookup failed:', userError)
    return
  }
  if (!user) return // no matching (non-deleted) account — silent no-op

  const since = new Date(Date.now() - HOUR_MS).toISOString()
  const { count, error: countError } = await supabase
    .from('password_reset_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)
  if (countError) {
    console.error('[password-reset] rate check failed:', countError)
    return
  }
  if ((count || 0) >= MAX_PER_HOUR) return // rate limited — still silent, see above

  // Expire (not delete) prior pending tokens — same created_at-preserving
  // rationale as api/_lib/verification.js's createAndSendVerificationEmail:
  // deleting would reset the rate-limit count computed above right back
  // down to 1 on every request.
  await supabase.from('password_reset_tokens').update({ expires_at: new Date().toISOString() }).eq('user_id', user.id).is('used_at', null)

  const token = crypto.randomUUID()
  const { error: insertError } = await supabase.from('password_reset_tokens').insert({ user_id: user.id, token })
  if (insertError) {
    console.error('[password-reset] failed to create token:', insertError)
    return
  }

  try {
    await sendPasswordResetEmail({ email, token, languagePreference: user.language_preference })
  } catch (err) {
    console.error('[password-reset] failed to send email:', err)
  }
}
