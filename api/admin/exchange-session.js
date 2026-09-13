import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { createAdminToken } from '../_lib/adminAuth.js'

// Bridges a regular authenticated session into a real admin token, so an
// admin-flagged user already logged into the main app can jump to /admin
// (see the header link in TopBar.jsx / openAdminPanel in adminApi.js)
// without re-entering credentials. Deliberately uses createStudentHandler
// (a regular X-Session-Token), not createAdminHandler — same reasoning
// api/admin/auth.js already documents for using createPublicHandler
// instead: no admin token exists yet at this point, so this has to be
// reachable via the caller's existing regular session.
//
// Eligibility is account_type='admin' OR users.is_admin — the latter lets
// an otherwise-ordinary account (e.g. a student test account) get admin
// access without losing its normal account_type-gated behavior elsewhere.
async function handle({ userId }) {
  const { data: user, error } = await supabase.from('users').select('account_type, is_admin').eq('id', userId).is('deleted_at', null).maybeSingle()
  if (error) throw error
  if (!user || (!user.is_admin && user.account_type !== 'admin')) {
    const err = new Error('This account does not have admin access.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }
  return createAdminToken(userId) // { token, expiresAt } — same shape api/admin/auth.js already returns
}

export default createStudentHandler({ method: 'POST', handle })
