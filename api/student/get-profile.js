import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { SAFE_USER_COLUMNS, isLinkedParentDeleted } from '../_lib/db.js'

// Backs getCurrentUser() in src/lib/storage.js for BOTH student and parent
// accounts — despite the /student/ path (matching the endpoint list this
// was requested under), the underlying users-table lookup doesn't depend on
// account_type, and getCurrentUser() is the one shared login/session check
// both StudentFlow and ParentDashboard rely on. Returns every column except
// password (excluded explicitly — nothing client-side reads it, and the
// previous direct-Supabase equivalent, findUserById, used to send the
// bcrypt hash to the browser for no reason; fixed here as a free byproduct
// of the migration, not a client-visible behavior change).
//
// deleted_at itself is never returned to the client (not in
// SAFE_USER_COLUMNS) — a deleted account's own session was already purged
// by delete-account.js, so this endpoint would 401 for them before ever
// reaching here anyway. linked_parent_deleted is added for students only —
// see isLinkedParentDeleted's header comment.
async function handle({ userId }) {
  const { data, error } = await supabase.from('users').select(SAFE_USER_COLUMNS).eq('id', userId).maybeSingle()
  if (error) throw error
  if (!data) {
    const err = new Error('User not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (data.account_type === 'student') {
    data.linked_parent_deleted = await isLinkedParentDeleted(userId)
  }
  return data
}

export default createStudentHandler({ method: 'GET', handle })
