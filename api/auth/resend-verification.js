import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { createAndSendVerificationEmail } from '../_lib/verification.js'

const MAX_PER_HOUR = 3
const HOUR_MS = 60 * 60 * 1000

// Lives under api/auth/ (matching the spec's file path) but uses
// createStudentHandler, not createPublicHandler — this needs session auth
// (X-Session-Token), and the wrapper itself is generic despite its doc
// comment saying "student/questions"; api/auth/export-data.js already
// mixes a session-authenticated GET into this same directory.
async function handle({ userId }) {
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
  return { success: true }
}

export default createStudentHandler({ method: 'POST', handle })
