// Shared trial/premium status logic — used by every auth entry point
// (signup, login, oauth-callback, oauth-merge), get-profile.js, the daily
// expire-trials cron, and the admin panel, so "what does this user's
// subscription look like right now" is computed in exactly one place.
import { supabase } from './auth.js'

export const TRIAL_DAYS = 30

// Priority order matters: is_paying_subscriber always wins (a paying
// subscriber's trial_ends_at, if any, becomes irrelevant the moment they
// convert); then trial_ends_at (future = active, past = expired); 'free'
// is the fallback for a row with no trial data at all — pre-trial-system
// accounts that were never grandfathered, or a genuinely brand-new row
// that somehow missed trial activation.
// Returns snake_case keys (subscription_status/days_remaining_in_trial)
// deliberately, not camelCase — every call site spreads this straight into
// a JSON API response (get-profile.js, login.js, oauth-callback.js,
// oauth-merge.js, signup.js, the admin endpoints), and every other field
// on those same user objects is already snake_case, so this matches
// rather than needing a transform at each call site.
export function getSubscriptionStatus(user) {
  if (user.is_paying_subscriber) return { subscription_status: 'premium', days_remaining_in_trial: null }

  if (user.trial_ends_at) {
    const msRemaining = new Date(user.trial_ends_at).getTime() - Date.now()
    if (msRemaining > 0) {
      // Ceil, not floor/round — "23 hours left" should still read as "1
      // day remaining" (and trigger the banner's "ends today" copy), not
      // silently round down to 0 and disappear a few hours early.
      return { subscription_status: 'trial_active', days_remaining_in_trial: Math.ceil(msRemaining / 86400000) }
    }
    return { subscription_status: 'trial_expired', days_remaining_in_trial: null }
  }

  return { subscription_status: 'free', days_remaining_in_trial: null }
}

// Called from every place a session gets (re)issued or refreshed (login,
// oauth-callback, oauth-merge, get-profile) — a lazy, per-request mirror
// of what the daily expire-trials cron does in bulk, so a lapsed trial
// doesn't stay "premium" for up to 24h just because the cron hasn't run
// yet. Only ever flips is_premium FALSE (never sets it true — trial
// activation and admin grants are the only paths allowed to do that), and
// only touches the DB when something would actually change. Returns the
// user object with is_premium corrected if needed, so callers can hand
// back the accurate value without a second round trip.
export async function syncTrialExpiry(user) {
  if (!user.is_premium || user.is_paying_subscriber || !user.trial_ends_at) return user
  if (new Date(user.trial_ends_at).getTime() > Date.now()) return user

  const { error } = await supabase.from('users').update({ is_premium: false }).eq('id', user.id)
  if (error) {
    console.error('[subscription] failed to sync expired trial:', error)
    return user
  }
  return { ...user, is_premium: false }
}

// Server-side enforcement for premium-gated endpoints — the UI's own
// isPremium checks (StudentHome.jsx etc.) only hide buttons; this is what
// actually stops a direct API call from a trial_expired/free account.
// Re-fetches from the DB rather than trusting a caller-supplied user
// object, since this has to be safe to call as the very first line of a
// handler with nothing but a userId. Runs the same syncTrialExpiry check
// login/get-profile do, so a request arriving right as a trial lapses
// still gets is_premium corrected in the DB before the allow/deny decision
// is made — not just a stale cached true from before it expired.
export async function requirePremium(userId) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, is_premium, trial_ends_at, is_paying_subscriber')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!user) return { allowed: false, code: 'PREMIUM_REQUIRED' }

  const synced = await syncTrialExpiry(user)
  const { subscription_status } = getSubscriptionStatus(synced)
  const allowed = subscription_status === 'trial_active' || subscription_status === 'premium'
  return allowed ? { allowed: true } : { allowed: false, code: 'PREMIUM_REQUIRED' }
}

// Throwing convenience wrapper around requirePremium — every gated
// endpoint's handle() just wants to bail out immediately on a locked
// account, so this matches the throw-based authorization-guard convention
// already used elsewhere in this codebase (e.g. verifyStudentBelongsToParent
// in parentDb.js) instead of repeating an if-check at 20+ call sites.
export async function assertPremium(userId) {
  const { allowed } = await requirePremium(userId)
  if (allowed) return
  const err = new Error('Premium required')
  err.status = 403
  err.code = 'PREMIUM_REQUIRED'
  throw err
}
