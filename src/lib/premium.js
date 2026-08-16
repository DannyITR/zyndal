// Client-side feature-gating must key off subscription_status, not the raw
// is_premium column — mirrors api/_lib/subscription.js's requirePremium,
// which is the actual server-side source of truth (assertPremium's allow
// check is exactly `subscription_status === 'trial_active' || 'premium'').
// is_premium is a separately-editable column (see api/admin/update-user.js,
// where an admin can push trial_ends_at into the future without touching
// is_premium) and can drift out of sync with what the trial dates actually
// say — a stale/desynced is_premium=false then makes every is_premium-gated
// button lock even while the trial banner (driven by subscription_status)
// correctly shows time remaining. subscription_status is always freshly
// recomputed server-side on every profile fetch (get-profile.js), so it
// can't drift the same way.
// Takes subscription_status directly (not the whole user object) so call
// sites can list it as a precise, primitive useEffect/useMemo dependency.
//
// Temporary promo switch — mirrors api/_lib/subscription.js's
// PREMIUM_ENFORCEMENT_ENABLED exactly (same flag name/meaning, kept as a
// separate constant since this is a different bundle) so client-side
// gating can't unlock anything the server would still reject, or vice
// versa. Flip both back to true together to restore normal gating.
export const PREMIUM_ENFORCEMENT_ENABLED = false

export function isPremiumUnlocked(subscriptionStatus) {
  if (!PREMIUM_ENFORCEMENT_ENABLED) return true
  return subscriptionStatus === 'trial_active' || subscriptionStatus === 'premium'
}
