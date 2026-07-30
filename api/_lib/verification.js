import { supabase } from './auth.js'
import { sendVerificationEmail } from './resend.js'

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
