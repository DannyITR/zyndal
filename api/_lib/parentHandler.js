import { applyCors } from './cors.js'
import { requireAuth, supabase } from './auth.js'

// Same shape as createStudentHandler (studentHandler.js), plus one extra
// check: the authenticated session must belong to a parent account, or the
// request is rejected with 403 (not 401 — the token itself is valid, the
// account just isn't authorized for this route). handle() receives
// { parentId, body } instead of { userId, body } to make the parent-only
// nature of these endpoints explicit at the call site.
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
    if (user.account_type !== 'parent') {
      res.status(403).json({ error: 'This action is only available to parent accounts.', code: 'FORBIDDEN' })
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
      const result = await handle({ parentId: userId, body })
      res.status(200).json(result)
    } catch (err) {
      console.error('[api] request failed:', err)
      res.status(err.status || 500).json({ error: err.message || 'Something went wrong. Please try again.', code: err.code || 'SERVER_ERROR' })
    }
  }
}
