import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

// Backs getCurrentUser() in src/lib/storage.js for BOTH student and parent
// accounts — despite the /student/ path (matching the endpoint list this
// was requested under), the underlying users-table lookup doesn't depend on
// account_type, and getCurrentUser() is the one shared login/session check
// both StudentFlow and ParentDashboard rely on. Returns every column except
// password (excluded explicitly — nothing client-side reads it, and the
// previous direct-Supabase equivalent, findUserById, used to send the
// bcrypt hash to the browser for no reason; fixed here as a free byproduct
// of the migration, not a client-visible behavior change).
async function handle({ userId }) {
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, username, account_type, grade, parent_code, created_at, display_name, email, school, avatar, wallet_balance_cents, total_added_cents, total_paid_out_cents, coin_to_dollar_rate, milestone_settings, is_premium, language_preference'
    )
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    const err = new Error('User not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  return data
}

export default createStudentHandler({ method: 'GET', handle })
