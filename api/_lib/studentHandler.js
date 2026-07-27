import { applyCors } from './cors.js'
import { requireAuth } from './auth.js'

// Shared wrapper for every /api/student and /api/questions endpoint: CORS,
// method check, session auth, request validation, and a consistent
// { error, code } error shape — each endpoint file only supplies its own
// validate(body) and handle({ userId, body }).
export function createStudentHandler({ method = 'GET', validate, handle }) {
  return async function (req, res) {
    if (applyCors(req, res)) return

    if (req.method !== method) {
      res.status(405).json({ error: `Method not allowed. Use ${method}.`, code: 'METHOD_NOT_ALLOWED' })
      return
    }

    const userId = await requireAuth(req, res)
    if (!userId) return

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

      const result = await handle({ userId, body })
      res.status(200).json(result)
    } catch (err) {
      console.error('[api] request failed:', err)
      res.status(err.status || err.statusCode || 500).json({ error: err.message || 'Something went wrong. Please try again.', code: err.code || 'SERVER_ERROR' })
    }
  }
}
