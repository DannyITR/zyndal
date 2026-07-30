import { supabase } from './auth.js'
import { sendVerificationEmail } from './resend.js'

const MAX_PER_HOUR = 3
const HOUR_MS = 60 * 60 * 1000

// Shared by api/auth/resend-verification.js (session-authenticated — the
// in-app "Resend email" banner) and api/auth/resend-expired-verification.js
// (public, keyed off possession of an expired token instead — someone
// clicking an expired email link almost certainly has no session on that
// device). Both funnel through this one function so the 3-per-hour limit
// is counted once per user regardless of which path they use, and can't be
// bypassed by alternating between them.
export async function resendVerificationForUser(userId) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('email, email_verified, language_preference')
    .eq('id', userId)
    .maybeSingle()
  if (userError) throw userError

  if (!user?.email) {
    const err = new Error('Add an email address in Settings first.')
    err.code = 'NO_EMAIL'
    err.status = 400
    throw err
  }

  if (user.email_verified) {
    const err = new Error('This email is already verified.')
    err.code = 'ALREADY_VERIFIED'
    err.status = 400
    throw err
  }

  const since = new Date(Date.now() - HOUR_MS).toISOString()
  const { count, error: countError } = await supabase
    .from('email_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since)
  if (countError) throw countError

  if ((count || 0) >= MAX_PER_HOUR) {
    const err = new Error('Too many requests — please try again later.')
    err.code = 'RATE_LIMITED'
    err.status = 429
    throw err
  }

  await createAndSendVerificationEmail({ userId, email: user.email, languagePreference: user.language_preference })
}

// Best-effort, non-throwing — mirrors insertNotification's convention
// (api/_lib/notifications.js): a failed token insert or email send must
// never fail the caller's own settings-save or resend action.
//
// Expires (rather than deletes) any still-pending token for this user
// first. Hard-deleting would erase the created_at history
// api/auth/resend-verification.js's per-hour rate limit counts against —
// a resend that deletes-then-recounts would let someone resend unlimited
// times, since the count would always land back at 1 right after. Setting
// expires_at to now achieves the same practical effect (the old link stops
// working) without losing that history.
export async function createAndSendVerificationEmail({ userId, email, languagePreference }) {
  await supabase
    .from('email_verifications')
    .update({ expires_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('verified_at', null)

  const token = crypto.randomUUID()
  const { error } = await supabase.from('email_verifications').insert({ user_id: userId, email, token })
  if (error) {
    console.error('[verification] failed to create token:', error)
    return
  }

  try {
    await sendVerificationEmail({ email, token, languagePreference })
  } catch (err) {
    console.error('[verification] failed to send email:', err)
  }
}
