import crypto from 'crypto'
import { createPublicHandler } from '../_lib/publicHandler.js'
import { createAdminToken } from '../_lib/adminAuth.js'

// The one hardcoded admin identity — not a users-table row, so there's no
// account to look up. Username is fixed at "admin"; only the password is
// actually a secret (ADMIN_PASSWORD). Goes through createPublicHandler (not
// createAdminHandler) since, by definition, no admin token exists yet at
// login time — same reason api/auth/login.js uses createPublicHandler
// instead of createStudentHandler. Its built-in rate limiting matters here
// specifically because this is a password-guessing surface.
function validate(body) {
  if (typeof body.username !== 'string' || !body.username) {
    return { field: 'username', message: 'Username is required.' }
  }
  if (typeof body.password !== 'string' || !body.password) {
    return { field: 'password', message: 'Password is required.' }
  }
  return null
}

// Constant-time comparison so a failed login can't leak how many leading
// characters of ADMIN_PASSWORD the guess got right via response timing.
function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

async function handle({ body }) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    const err = new Error('Admin panel is not configured.')
    err.status = 500
    err.code = 'ADMIN_NOT_CONFIGURED'
    throw err
  }

  if (body.username !== 'admin' || !timingSafeStringEqual(body.password, expected)) {
    const err = new Error('Invalid admin credentials.')
    err.status = 401
    err.code = 'INVALID_CREDENTIALS'
    throw err
  }

  return createAdminToken()
}

export default createPublicHandler({ method: 'POST', validate, handle })
