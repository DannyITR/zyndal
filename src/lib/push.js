// Browser Push-API plumbing — deliberately separate from storage.js
// (Supabase-backed data calls); this file only touches
// navigator.serviceWorker/PushManager and the one storage.js wrapper that
// actually persists a subscription. See public/sw.js for the 'push' and
// 'notificationclick' listeners this feeds, and api/_lib/push.js for the
// server-side send path.
import { subscribeToPushNotifications } from './storage'

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

// Web Push's applicationServerKey wants a Uint8Array, not the base64url
// string VAPID keys are normally shared as — this is the standard
// conversion every Web Push guide uses, self-contained here rather than
// pulling in a dependency for four lines of base64 decoding.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

// Resolves to true on a real subscription saved server-side, false for
// every "didn't happen" case (unsupported browser, permission not
// granted, subscribe failed) — callers branch on this rather than a
// thrown error, since none of those cases are actionable failures.
export async function subscribeToPush() {
  if (!isPushSupported()) return false

  try {
    const registration = await navigator.serviceWorker.ready
    const applicationServerKey = urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
    await subscribeToPushNotifications(subscription.toJSON())
    return true
  } catch (err) {
    console.error('[push] subscribe failed:', err)
    return false
  }
}
