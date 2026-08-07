import { useTranslation } from 'react-i18next'

// Small, one-line status line shown at the top of premium-gated pages
// (Study Guide, Test Prep, Uploads, Practice, My Grades, Wallet/Finances)
// for users who already have access — a quiet confirmation, not an alert.
// Renders nothing for trial_expired/free (they never reach these pages;
// the upgrade modal intercepts them instead) or when TopBar's caller
// simply doesn't pass a subscriptionStatus at all, which is how every
// free page (daily questions, leaderboard, friends, calendar, curriculum,
// classes) stays untouched by this without needing its own opt-out flag.
export default function PremiumFeatureBanner({ subscriptionStatus, daysRemainingInTrial }) {
  const { t } = useTranslation()

  if (subscriptionStatus === 'trial_active') {
    return <p className="premium-feature-banner">{t('premiumBanner.trialActive', { count: daysRemainingInTrial })}</p>
  }
  if (subscriptionStatus === 'premium') {
    return <p className="premium-feature-banner">{t('premiumBanner.premium')}</p>
  }
  return null
}
