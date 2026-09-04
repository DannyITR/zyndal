import { applyCors } from './cors.js'
import { verifyAdminToken } from './adminAuth.js'

// Same shape as createStudentHandler/createParentHandler, but for
// /api/admin/* endpoints: validates X-Admin-Token (see adminAuth.js)
// instead of a regular user session, since every admin now has a real
// users-table row (account_type = 'admin' — see api/admin/auth.js) but
// still authenticates via its own separate token, never a regular
// sessions-table session. handle() receives { body, adminId } — adminId is
// the calling admin's own users.id (from the token, tamper-proof via its
// HMAC signature), needed by anything admin-messaging-related that has to
// attribute a sent message to a specific admin; every existing admin
// endpoint's handle({ body }) destructuring simply ignores the extra field,
// so this is non-breaking for the rest of the admin panel.
export function createAdminHandler({ method = 'GET', validate, handle }) {
  return async function (req, res) {
    if (applyCors(req, res)) return

    if (req.method !== method) {
      res.status(405).json({ error: `Method not allowed. Use ${method}.`, code: 'METHOD_NOT_ALLOWED' })
      return
    }

    const token = req.headers['x-admin-token']
    const adminId = verifyAdminToken(token)
    if (!adminId) {
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

      const result = await handle({ body, adminId })
      res.status(200).json(result)
    } catch (err) {
      console.error('[admin api] request failed:', err)
      const body = { error: err.message || 'Something went wrong. Please try again.', code: err.code || 'SERVER_ERROR' }
      if (err.userMessage) body.message = err.userMessage
      res.status(err.status || err.statusCode || 500).json(body)
    }
  }
}
