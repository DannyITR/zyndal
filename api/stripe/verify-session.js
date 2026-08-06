import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { SAFE_USER_COLUMNS } from '../_lib/db.js'
import { getSubscriptionStatus, syncTrialExpiry } from '../_lib/subscription.js'
import { getStripeClient } from '../_lib/stripe.js'
import { applyCheckoutCompleted } from '../_lib/stripeSubscription.js'

function validate(query) {
  if (!query.session_id) return 'session_id is required.'
  return null
}

// Backs the /subscription/success page — a browser-redirect race against
// api/stripe/webhook.js (see applyCheckoutCompleted's own comment). Whichever
// of the two fires first does the real DB work; this just needs to report
// back what happened for the success screen's copy.
async function handle({ userId, body }) {
  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.retrieve(body.session_id)

  // Blocks a signed-in user from passing another account's session_id to
  // read back payment confirmation for someone else's purchase.
  if (session.metadata?.user_id !== userId) {
    const err = new Error('This checkout session does not belong to your account.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }

  if (session.payment_status !== 'paid') {
    return { paid: false }
  }

  const { plan, cascaded } = await applyCheckoutCompleted(session)

  const { data: userRow, error } = await supabase.from('users').select(SAFE_USER_COLUMNS).eq('id', userId).maybeSingle()
  if (error) throw error
  const synced = await syncTrialExpiry(userRow)
  Object.assign(synced, getSubscriptionStatus(synced))

  return { paid: true, plan, cascaded, user: synced }
}

export default createStudentHandler({ method: 'GET', validate, handle })
