import { applyCors } from './cors.js'
import { verifyAdminToken } from './adminAuth.js'

// Same shape as createStudentHandler/createParentHandler, but for
// /api/admin/* endpoints: validates X-Admin-Token (see adminAuth.js)
// instead of a regular user session — a valid ADMIN_PASSWORD login never
// creates a `sessions` row or a `users`-table identity, so this deliberately
// does NOT go through requireAuth/getUserIdFromToken at all. handle()
// receives only { body } (no userId/parentId) since there's no per-request
// identity beyond "is this the admin."
export function createAdminHandler({ method = 'GET', validate, handle }) {
  return async function (req, res) {
    if (applyCors(req, res)) return

    if (req.method !== method) {
      res.status(405).json({ error: `Method not allowed. Use ${method}.`, code: 'METHOD_NOT_ALLOWED' })
      return
    }

    const token = req.headers['x-admin-token']
    if (!verifyAdminToken(token)) {
      res.status(401).json({ error: 'Invalid or expired admin session.', code: 'ADMIN_UNAUTHENTICATED' })
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
          if (typeof validationError === 'string') {
            res.status(400).json({ error: validationError, code: 'VALIDATION_ERROR' })
          } else {
            res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR', field: validationError.field, message: validationError.message })
          }
          return
        }
      }

      const result = await handle({ body })
      res.status(200).json(result)
    } catch (err) {
      console.error('[admin api] request failed:', err)
      const body = { error: err.message || 'Something went wrong. Please try again.', code: err.code || 'SERVER_ERROR' }
      if (err.userMessage) body.message = err.userMessage
      res.status(err.status || err.statusCode || 500).json(body)
    }
  }
}
