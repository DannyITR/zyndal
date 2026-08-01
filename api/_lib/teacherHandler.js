import { applyCors } from './cors.js'
import { requireAuth, supabase } from './auth.js'

// Same shape as createParentHandler/createStudentHandler, but scoped
// strictly to account_type = 'teacher' — unlike parentHandler.js (which
// deliberately treats 'teacher' as parent-like for the wallet/payout
// features that share ParentDashboard), class management and homework
// assignment are teacher-only actions with no parent equivalent, so a
// parent session must never be able to call these. handle() receives
// { teacherId, body }, matching parentHandler's { parentId, body } naming
// convention for the same reason: making the "whose id is this" question
// unambiguous at every call site.
export function createTeacherHandler({ method = 'GET', validate, handle }) {
  return async function (req, res) {
    if (applyCors(req, res)) return

    if (req.method !== method) {
      res.status(405).json({ error: `Method not allowed. Use ${method}.`, code: 'METHOD_NOT_ALLOWED' })
      return
    }

    const userId = await requireAuth(req, res)
    if (!userId) return

    const { data: user, error } = await supabase.from('users').select('account_type').eq('id', userId).maybeSingle()
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired session.', code: 'UNAUTHENTICATED' })
      return
    }
    if (user.account_type !== 'teacher') {
      res.status(403).json({ error: 'This action is only available to teacher accounts.', code: 'FORBIDDEN' })
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

      const result = await handle({ teacherId: userId, body })
      res.status(200).json(result)
    } catch (err) {
      console.error('[api] request failed:', err)
      const body = { error: err.message || 'Something went wrong. Please try again.', code: err.code || 'SERVER_ERROR' }
      if (err.userMessage) body.message = err.userMessage
      res.status(err.status || err.statusCode || 500).json(body)
    }
  }
}
