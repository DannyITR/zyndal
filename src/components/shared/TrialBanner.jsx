import { useTranslation } from 'react-i18next'

// Days 30-8: normal (purple). Days 7-4: warning (amber). Days 3-1: urgent
// (red), with day 1 getting its own "ends today" copy instead of the
// generic countdown — see the spec's own tiering.
function tierFor(days) {
  if (days <= 3) return 'urgent'
  if (days <= 7) return 'warning'
  return 'normal'
}

// Renders nothing outside subscription_status === 'trial_active' — a
// premium/expired/free user sees no banner at all here (expired/free get
// the reactive UpgradeModal instead, when they tap a gated feature).
// Shared across the student home screen, parent dashboard, and teacher
// dashboard, all of which already have subscription_status/
// days_remaining_in_trial on their own `user` object from get-profile.js.
export default function TrialBanner({ subscriptionStatus, daysRemainingInTrial, onUpgradeClick }) {
  const { t } = useTranslation()
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
