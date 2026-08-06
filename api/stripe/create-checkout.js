import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getStripeClient, PRICE_IDS } from '../_lib/stripe.js'
import { getParentLinks, verifyStudentBelongsToParent } from '../_lib/parentDb.js'

const SUCCESS_URL = 'https://zyndal.ca/subscription/success?session_id={CHECKOUT_SESSION_ID}'
const CANCEL_URL = 'https://zyndal.ca/subscription/cancelled'

function validate(body) {
  if (body.plan !== 'student' && body.plan !== 'family') return 'plan must be "student" or "family".'
  if (body.student_id !== undefined && typeof body.student_id !== 'string') return 'student_id must be a string.'
  return null
}

// Family-plan coverage is a purchase-time snapshot of whoever's linked
// right now, capped at 5 and frozen into Checkout metadata — it is not
// re-synced if the parent links/unlinks a student afterward. parent_student
// has no link-creation timestamp to order by, so the cap uses the
// students' own account age instead.
async function resolveFamilyStudentIds(parentId) {
  const links = await getParentLinks(parentId)
  if (links.length === 0) {
    const err = new Error('Add a child in Settings before subscribing to the Family plan.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }
  const linkedIds = links.map((l) => l.student_id)
  if (linkedIds.length <= 5) return linkedIds

  const { data: capped, error } = await supabase.from('users').select('id').in('id', linkedIds).order('created_at', { ascending: true }).limit(5)
  if (error) throw error
  return capped.map((u) => u.id)
}

async function handle({ userId, body }) {
  const { plan, student_id: studentIdInput } = body

  const { data: caller, error: callerError } = await supabase
    .from('users')
    .select('id, account_type, email, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()
  if (callerError) throw callerError
  if (!caller) {
    const err = new Error('Account not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  if (plan === 'family' && caller.account_type !== 'parent') {
    const err = new Error('The Family plan is only available to parent accounts.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  // Cascade metadata: a parent buying either plan covers their linked
  // student(s), never their own account (parents already bypass every
  // premium check — see api/_lib/subscription.js). A student or teacher
  // buying directly is a self-purchase, carrying neither metadata field —
  // see api/_lib/stripeSubscription.js's applyCheckoutCompleted for how
  // that absence is read back out.
  const metadata = { user_id: userId, plan }
  if (caller.account_type === 'parent') {
    if (plan === 'student') {
      if (!studentIdInput) {
        const err = new Error('student_id is required when a parent buys the Student plan.')
        err.status = 400
        err.code = 'VALIDATION_ERROR'
        throw err
      }
      await verifyStudentBelongsToParent(userId, studentIdInput)
      metadata.student_id = studentIdInput
    } else {
      const studentIds = await resolveFamilyStudentIds(userId)
      metadata.student_ids = JSON.stringify(studentIds)
    }
  }

  const stripe = getStripeClient()

  let customerId = caller.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({ email: caller.email || undefined, metadata: { user_id: userId } })
    customerId = customer.id
  }
  // Written immediately (not deferred to the webhook) so this row is
  // provably "the billing owner" even before Checkout completes —
  // api/stripe/customer-portal.js and the reversal handlers in
  // stripeSubscription.js both key off is_subscription_owner.
  const { error: ownerError } = await supabase.from('users').update({ stripe_customer_id: customerId, is_subscription_owner: true }).eq('id', userId)
  if (ownerError) throw ownerError

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
    allow_promotion_codes: true,
    metadata,
    subscription_data: { metadata },
  })

  return { checkout_url: session.url }
}

export default createStudentHandler({ method: 'POST', validate, handle })
