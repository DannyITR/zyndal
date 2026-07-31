import { createPublicHandler } from '../_lib/publicHandler.js'
import { sanitizeEmail } from '../_lib/sanitize.js'
import { requestPasswordResetForEmail } from '../_lib/passwordReset.js'

function validate(body) {
  if (!body.email || typeof body.email !== 'string') return 'email is required.'
  return null
}

// Always returns the same response no matter what actually happened
// internally (no account, rate limited, or genuinely sent) — see
// api/_lib/passwordReset.js's comment for why that has to include the
// rate-limit case too, not just "no such email."
async function handle({ body }) {
  const email = sanitizeEmail(body.email) || body.email
  await requestPasswordResetForEmail(email)
  return { success: true }
}

export default createPublicHandler({ method: 'POST', validate, handle })
