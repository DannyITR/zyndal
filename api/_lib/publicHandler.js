import { applyCors } from './cors.js'
import { isRateLimited } from './rateLimit.js'

// Shared wrapper for /api/auth/* endpoints — the one place session-token
// auth can't apply, since login/signup run BEFORE a token exists and logout
// only has a (possibly already-expired) token to go on. CORS + rate limiting
// (login/signup are the app's only password-guessing/account-enumeration
// surface) + the same { error, code } shape as studentHandler/parentHandler,
// but no requireAuth step.
export function createPublicHandler({ method = 'POST', validate, handle }) {
  return async function (req, res) {
    if (applyCors(req, res)) return

    if (req.method !== method) {
      res.status(405).json({ error: `Method not allowed. Use ${method}.`, code: 'METHOD_NOT_ALLOWED' })
      return
    }

    if (isRateLimited(req)) {
      res.status(429).json({ error: 'Too many requests. Please try again in a minute.', code: 'RATE_LIMITED' })
      return
    }

    try {
      // req.body is a lazy getter (Vercel's dev/prod runtime parses it on
      // first access) that THROWS on malformed JSON — reading it has to
      // happen inside this try, or a client sending a bad Content-Type:
      // application/json body with garbage bytes crashes the whole
      // function with an uncaught exception instead of getting a clean 400.
      const body = method === 'GET' ? req.query || {} : req.body || {}
      if (validate) {
        const validationError = validate(body)
        if (validationError) {
          // validate() returns either a plain string (legacy — becomes the
          // error message directly) or { field, message } from a
          // sanitize.js check, which gets the richer shape callers can key
          // off of.
          if (typeof validationError === 'string') {
            res.status(400).json({ error: validationError, code: 'VALIDATION_ERROR' })
          } else {
            res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR', field: validationError.field, message: validationError.message })
          }
          return
        }
      }

      const result = await handle({ req, body })
      res.status(200).json(result)
    } catch (err) {
      console.error('[api] request failed:', err)
      // err.userMessage carries an optional longer, more actionable message
      // alongside the short err.message label (e.g. api/auth/login.js's
      // ACCOUNT_DELETED: error="Account deactivated", message="This account
      // has been deleted. Email hello@zyndal.ca...") — most thrown errors
      // don't set it, so `message` is simply omitted for those.
      const body = { error: err.message || 'Something went wrong. Please try again.', code: err.code || 'SERVER_ERROR' }
      if (err.userMessage) body.message = err.userMessage
      res.status(err.status || err.statusCode || 500).json(body)
    }
  }
}
