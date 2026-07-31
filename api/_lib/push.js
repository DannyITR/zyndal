// Server-only Web Push client — mirrors api/_lib/resend.js's lazy-client
// pattern. VAPID_PUBLIC_KEY has no VITE_ prefix on purpose (this is the
// server-side copy web-push's setVapidDetails() needs) — the browser gets
// the same public key value via the separately-set VITE_VAPID_PUBLIC_KEY
// (see .env's comment). Never imported by anything under src/.
import webpush from 'web-push'
import { supabase } from './auth.js'

let configured = false
function getWebPushClient() {
  if (configured) return webpush
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL
  if (!publicKey || !privateKey || !email) throw new Error('Missing VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_EMAIL environment variables.')
  webpush.setVapidDetails(email, publicKey, privateKey)
  configured = true
  return webpush
}

// Best-effort, non-throwing — mirrors insertNotification's convention:
// this is a bonus real-time layer on top of the in-app notifications
// table, never allowed to fail the caller's own share/friend-request/cron
// action just because a push send hiccups. Skips silently (not an error)
// when the user has no subscription, has push disabled entirely
// (notification_preferences.enabled === false), or has this specific
// type disabled — a user who signed up before notification_preferences
// existed gets the column's SQL default (all true), so no null-check
// dance is needed here.
export async function sendPushToUser({ userId, type, title, body, url }) {
  const { data: user, error: userError } = await supabase.from('users').select('notification_preferences').eq('id', userId).maybeSingle()
  if (userError) {
    console.error('[push] failed to load notification_preferences:', userError)
    return
  }
  const prefs = user?.notification_preferences
  if (prefs && (prefs.enabled === false || prefs[type] === false)) return

  const { data: sub, error: subError } = await supabase.from('push_subscriptions').select('id, subscription').eq('user_id', userId).maybeSingle()
  if (subError) {
    console.error('[push] failed to load subscription:', subError)
    return
  }
  if (!sub) return // never subscribed on any device

  try {
    const client = getWebPushClient()
    await client.sendNotification(sub.subscription, JSON.stringify({ title, body, url }))
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      // Subscription expired or was revoked browser-side — delete it so
      // future sends don't keep hitting the same dead endpoint.
      await supabase.from('push_subscriptions').delete().eq('id', sub.id)
    } else {
      console.error('[push] send failed:', err)
    }
  }
}
