import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { SAFE_USER_COLUMNS, getLinkedParentStatus } from '../_lib/db.js'
import { getSubscriptionStatus, syncTrialExpiry } from '../_lib/subscription.js'

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
// reaching here anyway. linked_parent_deleted and has_linked_parent are
// added for students only — see getLinkedParentStatus's header comment.
// has_linked_parent drives the Coins stat box's visibility (StudentFlow.jsx)
// and whether the Wallet page is reachable at all.
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
    const { linked, parentDeleted } = await getLinkedParentStatus(userId)
    data.has_linked_parent = linked
    data.linked_parent_deleted = parentDeleted
  }
  // Called on every app mount/session restore (see getCurrentUser in
  // storage.js), so this is the main place — alongside login — that
  // actually catches a trial lapsing without waiting on the once-daily
  // cron. subscription_status/days_remaining_in_trial drive the trial
  // banner and the admin panel's subscription column.
  const synced = await syncTrialExpiry(data)
  Object.assign(synced, getSubscriptionStatus(synced))
  return synced
}

export default createStudentHandler({ method: 'GET', handle })
