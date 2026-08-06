import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getStripeClient } from '../_lib/stripe.js'

async function handle({ userId }) {
  const { data: caller, error } = await supabase.from('users').select('stripe_customer_id, is_subscription_owner').eq('id', userId).maybeSingle()
  if (error) throw error

  // A cascaded student (premium via a linked parent's plan) has no Stripe
  // Customer of their own to manage — see SettingsScreen.jsx, which never
  // even renders the "Manage subscription" button for that case, but this
  // still guards the endpoint directly against a direct API call.
  if (!caller?.stripe_customer_id || !caller.is_subscription_owner) {
    const err = new Error('No billing account found for this user.')
    err.status = 400
    err.code = 'NO_BILLING_ACCOUNT'
    throw err
  }

  const stripe = getStripeClient()
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: caller.stripe_customer_id,
    return_url: 'https://zyndal.ca/',
  })

  return { portal_url: portalSession.url }
}

export default createStudentHandler({ method: 'POST', handle })
