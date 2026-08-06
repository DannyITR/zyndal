import { getStripeClient } from '../_lib/stripe.js'
import { applyCheckoutCompleted, handleSubscriptionUpdated, handleSubscriptionDeleted, handlePaymentFailed } from '../_lib/stripeSubscription.js'

// Stripe signature verification needs the RAW, unparsed request body —
// disabling Vercel's automatic JSON body-parsing for exactly this route
// (the same `config` export mechanism api/questions/generate-question-pool.js
// already uses for maxDuration) is what makes that possible.
export const config = { api: { bodyParser: false } }

async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

// Bespoke handler, not createStudentHandler/createPublicHandler — Stripe
// calls this server-to-server with no session token and no browser Origin,
// so neither CORS nor session auth applies; the Stripe-Signature header
// (verified below) is the only authentication this endpoint has or needs.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.', code: 'METHOD_NOT_ALLOWED' })
    return
  }

  const stripe = getStripeClient()
  const signature = req.headers['stripe-signature']

  let event
  try {
    const rawBody = await getRawBody(req)
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err.message)
    res.status(400).json({ error: 'Invalid signature.', code: 'INVALID_SIGNATURE' })
    return
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await applyCheckoutCompleted(event.data.object)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(event)
        break
      default:
        break
    }
    // Always 200 on success so Stripe stops retrying. A genuine unhandled
    // exception below falls through to the 500 catch instead — safe to let
    // Stripe retry those, since every DB write above is idempotent and every
    // one-shot side effect (email/notification) is claim-gated.
    res.status(200).json({ received: true })
  } catch (err) {
    console.error('[stripe webhook] handler failed:', err)
    res.status(500).json({ error: 'Webhook handler failed.', code: 'SERVER_ERROR' })
  }
}
