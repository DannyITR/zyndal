import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

function validate(body) {
  if (!body.subscription || typeof body.subscription !== 'object') {
    return { field: 'subscription', message: 'subscription is required.' }
  }
  return null
}

// Replace-if-exists — a device re-subscribing (e.g. after clearing site
// data, or a browser rotating the push endpoint) should only ever have
// one live subscription row per user, not an accumulating pile of stale
// ones. Delete-then-insert rather than .upsert(): the table only has an
// index on user_id, not a unique constraint, so upsert's onConflict
// target isn't available here.
async function handle({ userId, body }) {
  const { error: deleteError } = await supabase.from('push_subscriptions').delete().eq('user_id', userId)
  if (deleteError) throw deleteError

  const { error: insertError } = await supabase.from('push_subscriptions').insert({ user_id: userId, subscription: body.subscription })
  if (insertError) throw insertError

  return { success: true }
}

export default createStudentHandler({ method: 'POST', validate, handle })
