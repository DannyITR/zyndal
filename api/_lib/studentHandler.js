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

    const body = method === 'GET' ? req.query || {} : req.body || {}
    if (validate) {
      const validationError = validate(body)
      if (validationError) {
        res.status(400).json({ error: validationError, code: 'VALIDATION_ERROR' })
        return
      }
    }

    try {
      const result = await handle({ userId, body })
      res.status(200).json(result)
    } catch (err) {
      console.error('[api] request failed:', err)
      res.status(err.status || 500).json({ error: err.message || 'Something went wrong. Please try again.', code: err.code || 'SERVER_ERROR' })
    }
  }
}
