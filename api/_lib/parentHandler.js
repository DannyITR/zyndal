import { applyCors } from './cors.js'
import { requireAuth, supabase } from './auth.js'

// Same shape as createStudentHandler (studentHandler.js), plus one extra
// check: the authenticated session must belong to a parent (or teacher —
// see below) account, or the request is rejected with 403 (not 401 — the
// token itself is valid, the account just isn't authorized for this
// route). handle() receives { parentId, body } instead of { userId, body }
// to make the parent-only nature of these endpoints explicit at the call
// site; teacher accounts are treated identically to parent accounts here
// (they share ParentDashboard — see App.jsx — until class-specific teacher
// features exist), so `parentId` for a teacher caller is really "this
// teacher's own user id," same as it always meant for a parent.
const PARENT_LIKE_ACCOUNT_TYPES = ['parent', 'teacher']
export function createParentHandler({ method = 'GET', validate, handle }) {
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
    if (!PARENT_LIKE_ACCOUNT_TYPES.includes(user.account_type)) {
      res.status(403).json({ error: 'This action is only available to parent accounts.', code: 'FORBIDDEN' })
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

      const result = await handle({ parentId: userId, body })
      res.status(200).json(result)
    } catch (err) {
      console.error('[api] request failed:', err)
      // err.userMessage carries an optional longer, more actionable message
      // alongside the short err.message label — most thrown errors don't
      // set it, so `message` is simply omitted for those.
      const body = { error: err.message || 'Something went wrong. Please try again.', code: err.code || 'SERVER_ERROR' }
      if (err.userMessage) body.message = err.userMessage
      res.status(err.status || err.statusCode || 500).json(body)
    }
  }
}
