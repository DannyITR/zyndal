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

    const body = method === 'GET' ? req.query || {} : req.body || {}
    if (validate) {
      const validationError = validate(body)
      if (validationError) {
        res.status(400).json({ error: validationError, code: 'VALIDATION_ERROR' })
        return
      }
    }

    try {
      const result = await handle({ req, body })
      res.status(200).json(result)
    } catch (err) {
      console.error('[api] request failed:', err)
      res.status(err.status || 500).json({ error: err.message || 'Something went wrong. Please try again.', code: err.code || 'SERVER_ERROR' })
    }
  }
}
