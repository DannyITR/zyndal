// Shared grant/revoke logic for Stripe subscription events — imported by
// both api/stripe/webhook.js (the real-time path) and
// api/stripe/verify-session.js (the browser-redirect path, which can win
// the race against the webhook if Stripe is slow to deliver it). Both call
// applyCheckoutCompleted with the same Checkout Session id as the
// idempotency key, so whichever fires first does the real work and the
// other is a safe no-op.
import { supabase } from './auth.js'
import { getStripeClient } from './stripe.js'
import { sendWelcomeEmail, sendPaymentFailedEmail, sendSubscriptionCancelledEmail } from './resend.js'
import { insertNotification } from './notifications.js'
import { notificationText } from './notificationText.js'

// Insert-and-catch-23505 idempotency idiom, same as recordPerfectWeekAchievement
// in db.js. Returns true the first time an id is claimed, false on every
// later attempt (a Stripe retry, or the webhook/verify-session race above).
export async function claimStripeEvent(id) {
  const { error } = await supabase.from('stripe_webhook_events').insert({ id })
  if (!error) return true
  if (error.code === '23505') return false
  throw error
}

// Every account type gets its own independent 30-day trial at signup
// (api/auth/signup.js), so a payer-only parent row can legitimately have
// is_premium=true from ITS OWN trial while never being a subscription
// recipient. Cascaded grants therefore never touch a cascade-initiating
// parent's own is_premium/is_paying_subscriber, and — critically for
// reversal safety — a payer-only row never gets stripe_subscription_id set,
// only stripe_customer_id. That's what lets the reversal handlers below key
// off .eq('stripe_customer_id',...).eq('stripe_subscription_id',...)
// without risk of wiping an unrelated trial on the parent's own row.
export async function applyCheckoutCompleted(session) {
  const stripe = getStripeClient()
  const buyerId = session.metadata?.user_id
  const plan = session.metadata?.plan
  const studentIds = session.metadata?.student_ids ? JSON.parse(session.metadata.student_ids) : null
  const studentId = session.metadata?.student_id || null
  const cascaded = Boolean(studentIds || studentId)
  const recipientIds = cascaded ? studentIds || [studentId] : [buyerId]

  const subscription = await stripe.subscriptions.retrieve(session.subscription)
  const subscriptionFields = {
    stripe_subscription_id: subscription.id,
    subscription_plan: plan,
    subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
  }

  if (cascaded) {
    const { error: buyerError } = await supabase
      .from('users')
      .update({ stripe_customer_id: session.customer, is_subscription_owner: true })
      .eq('id', buyerId)
    if (buyerError) throw buyerError

    const { error: recipientError } = await supabase
      .from('users')
      .update({ is_premium: true, is_paying_subscriber: true, stripe_customer_id: session.customer, ...subscriptionFields })
      .in('id', recipientIds)
    if (recipientError) throw recipientError
  } else {
    const { error } = await supabase
      .from('users')
      .update({
        stripe_customer_id: session.customer,
        is_subscription_owner: true,
        is_premium: true,
        is_paying_subscriber: true,
        ...subscriptionFields,
      })
      .eq('id', buyerId)
    if (error) throw error
  }

  if (await claimStripeEvent(session.id)) {
    const { data: buyer, error: buyerFetchError } = await supabase
      .from('users')
      .select('email, language_preference')
      .eq('id', buyerId)
      .maybeSingle()
    if (buyerFetchError) console.error('[stripe] failed to load buyer for welcome email:', buyerFetchError)
    else if (buyer?.email) {
      sendWelcomeEmail({ email: buyer.email, languagePreference: buyer.language_preference }).catch((err) =>
        console.error('[stripe] failed to send welcome email:', err)
      )
    }
  }

  return { plan, cascaded }
}

// The payer for a given Stripe customer — always the row with
// is_subscription_owner=true, whether that's a self-purchasing student/
// teacher or a cascade-initiating parent. Used to target payment-failed/
// cancellation emails, which must never land in a cascaded student's inbox.
async function findPayerByCustomerId(customerId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, language_preference')
    .eq('stripe_customer_id', customerId)
    .eq('is_subscription_owner', true)
    .maybeSingle()
  if (error) throw error
  return data
}

async function notifyPaymentFailed(customerId) {
  const payer = await findPayerByCustomerId(customerId)
  if (!payer) return
  const { title, body } = notificationText('subscription_payment_failed', payer.language_preference)
  await insertNotification({ userId: payer.id, type: 'subscription_payment_failed', title, body })
  if (payer.email) {
    await sendPaymentFailedEmail({ email: payer.email, languagePreference: payer.language_preference }).catch((err) =>
      console.error('[stripe] failed to send payment-failed email:', err)
    )
  }
}

export async function handleSubscriptionUpdated(event) {
  const subscription = event.data.object
  const customerId = subscription.customer
  const subscriptionId = subscription.id
  const status = subscription.status
  const periodEndIso = new Date(subscription.current_period_end * 1000).toISOString()

  const { data: matched, error: matchError } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .eq('stripe_subscription_id', subscriptionId)
  if (matchError) throw matchError
  const matchedIds = (matched || []).map((u) => u.id)
  if (matchedIds.length === 0) return

  if (status === 'active') {
    const { error } = await supabase
      .from('users')
      .update({ subscription_current_period_end: periodEndIso, is_premium: true, is_paying_subscriber: true })
      .in('id', matchedIds)
    if (error) throw error
  } else if (status === 'past_due') {
    const { error } = await supabase.from('users').update({ subscription_current_period_end: periodEndIso }).in('id', matchedIds)
    if (error) throw error
    if (await claimStripeEvent(event.id)) await notifyPaymentFailed(customerId)
  } else if (status === 'canceled' || status === 'unpaid') {
    const { error } = await supabase.from('users').update({ is_premium: false, is_paying_subscriber: false }).in('id', matchedIds)
    if (error) throw error
  }
}

export async function handleSubscriptionDeleted(event) {
  const subscription = event.data.object
  const customerId = subscription.customer
  const subscriptionId = subscription.id

  const { data: matched, error: matchError } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .eq('stripe_subscription_id', subscriptionId)
  if (matchError) throw matchError
  const matchedIds = (matched || []).map((u) => u.id)
  if (matchedIds.length > 0) {
    const { error } = await supabase
      .from('users')
      .update({
        is_premium: false,
        is_paying_subscriber: false,
        stripe_subscription_id: null,
        subscription_plan: null,
        subscription_current_period_end: null,
      })
      .in('id', matchedIds)
    if (error) throw error
  }

  if (await claimStripeEvent(event.id)) {
    const payer = await findPayerByCustomerId(customerId)
    if (payer) {
      const { title, body } = notificationText('subscription_cancelled', payer.language_preference)
      await insertNotification({ userId: payer.id, type: 'subscription_cancelled', title, body })
      if (payer.email) {
        await sendSubscriptionCancelledEmail({ email: payer.email, languagePreference: payer.language_preference }).catch((err) =>
          console.error('[stripe] failed to send cancellation email:', err)
        )
      }
    }
  }
}

// invoice.payment_failed and customer.subscription.updated(status:past_due)
// both fire for one real failed charge and are NOT deduped against each
// other here — each is claimed independently by its own event.id, matching
// how this codebase treats every other webhook-style event (one claim per
// event id, not per underlying real-world occurrence). A user may see two
// payment-failed emails/notifications for a single missed payment; accepted
// as literal-spec behavior rather than adding cross-event correlation logic
// that wasn't asked for.
export async function handlePaymentFailed(event) {
  const invoice = event.data.object
  const customerId = invoice.customer
  if (await claimStripeEvent(event.id)) await notifyPaymentFailed(customerId)
}
