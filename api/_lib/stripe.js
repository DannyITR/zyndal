// Server-only Stripe client — mirrors api/_lib/resend.js's lazy-client
// pattern. STRIPE_SECRET_KEY has no VITE_ prefix on purpose (see that
// file's comment): this name is what keeps it out of the client bundle.
// Never imported by anything under src/.
import Stripe from 'stripe'

let client = null
export function getStripeClient() {
  if (client) return client
  const apiKey = process.env.STRIPE_SECRET_KEY
  if (!apiKey) throw new Error('Missing STRIPE_SECRET_KEY environment variable.')
  client = new Stripe(apiKey)
  return client
}

export const PRICE_IDS = {
  student: process.env.STRIPE_PRICE_STUDENT,
  family: process.env.STRIPE_PRICE_FAMILY,
}
