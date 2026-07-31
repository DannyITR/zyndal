import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeEmail } from '../_lib/sanitize.js'

// Public GET, called by SignupForm.jsx right before signup() runs — email
// duplicates can't be checked "before inserting new user" the way username
// is in api/auth/signup.js, since that endpoint never collects email at
// all (see the follow-up updateUserProfile call in SignupForm.jsx). This
// pre-check avoids creating an account that then can't have its email
// attached; api/student/update-settings.js re-checks authoritatively
// (covers the race between this check and the follow-up save, and the
// separate "change email later in Settings" path this endpoint doesn't
// touch).
function validate(body) {
  if (!body.email || typeof body.email !== 'string') return 'email is required.'
  return null
}

async function handle({ body }) {
  // Malformed input isn't this endpoint's job to reject — SignupForm's own
  // client-side regex already gates that before this ever fires. Just
  // don't block submission over it here.
  const email = sanitizeEmail(body.email) || body.email

  const { data: existing, error } = await supabase.from('users').select('id').ilike('email', email).maybeSingle()
  if (error) throw error

  if (existing) {
    const err = new Error('Email already registered')
    err.status = 400
    err.code = 'EMAIL_EXISTS'
    err.userMessage = 'An account with this email already exists. Try logging in instead.'
    throw err
  }

  return { available: true }
}

export default createPublicHandler({ method: 'GET', validate, handle })
