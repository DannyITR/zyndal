import { useTranslation } from 'react-i18next'
import { PREMIUM_ENFORCEMENT_ENABLED } from '../../lib/premium'

// Days 30-8: normal (purple). Days 7-4: warning (amber). Days 3-1: urgent
// (red), with day 1 getting its own "ends today" copy instead of the
// generic countdown — see the spec's own tiering.
function tierFor(days) {
  if (days <= 3) return 'urgent'
  if (days <= 7) return 'warning'
  return 'normal'
}

// Renders nothing outside subscription_status === 'trial_active' or
// 'trial_expired' — a premium/free user sees no banner at all here (free
// gets the reactive UpgradeModal instead, when they tap a gated feature;
// premium has nothing to upgrade). Shared across the student home screen,
// parent dashboard, and teacher dashboard, all of which already have
// subscription_status/days_remaining_in_trial on their own `user` object
// from get-profile.js.
export default function TrialBanner({ subscriptionStatus, daysRemainingInTrial, onUpgradeClick }) {
  const { t } = useTranslation()

  // Temporary promo switch (see src/lib/premium.js) — no trial/upgrade
  // messaging while this is off, regardless of the account's real status.
  if (!PREMIUM_ENFORCEMENT_ENABLED) return null

  if (subscriptionStatus === 'trial_expired') {
    return (
      <button type="button" className="trial-banner trial-banner--urgent" onClick={onUpgradeClick}>
        {t('upgrade.trialExpiredBanner')}
      </button>
    )
  }

  if (subscriptionStatus !== 'trial_active' || daysRemainingInTrial == null) return null

  const tier = tierFor(daysRemainingInTrial)
  const text =
    daysRemainingInTrial <= 1 ? t('upgrade.trialBannerLastDay') : t('upgrade.trialBannerDays', { count: daysRemainingInTrial })

  return (
    <button type="button" className={`trial-banner trial-banner--${tier}`} onClick={onUpgradeClick}>
      {text}
    </button>
  )
}
