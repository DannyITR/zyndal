import { createStudentHandler } from '../_lib/studentHandler.js'
import { resendVerificationForUser } from '../_lib/verification.js'

// Lives under api/auth/ (matching the spec's file path) but uses
// createStudentHandler, not createPublicHandler — this needs session auth
// (X-Session-Token), and the wrapper itself is generic despite its doc
// comment saying "student/questions"; api/auth/export-data.js already
// mixes a session-authenticated GET into this same directory. Backs the
// logged-in "Resend email" verification banner (StudentFlow.jsx). See
// api/auth/resend-expired-verification.js for the public, no-session
// counterpart used from the /verify page itself.
async function handle({ userId }) {
  await resendVerificationForUser(userId)
  return { success: true }
}

export default createStudentHandler({ method: 'POST', handle })
