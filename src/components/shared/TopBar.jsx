import { useTranslation } from 'react-i18next'
import Logo from './Logo'
import PremiumFeatureBanner from './PremiumFeatureBanner'

// subscriptionStatus/daysRemainingInTrial are only ever passed by premium-
// gated screens (Study Guide, Test Prep, Uploads, Practice, My Grades,
// Wallet/Finances) — every free screen's <TopBar> call simply omits them,
// so PremiumFeatureBanner renders nothing there with no extra flag needed.
export default function TopBar({
  title,
  subtitle,
  username,
  onLogout,
  onBack,
  onSettings,
  onNotifications,
  unreadCount,
  onLogoClick,
  subscriptionStatus,
  daysRemainingInTrial,
}) {
  const { t } = useTranslation()
  return (
    <header className="topbar">
      <div className="topbar-brand-row">
        <Logo size="small" onClick={onLogoClick} />
      </div>
      <div className="topbar-main-row">
        <div className="topbar-title-row">
          {onBack && (
            <button type="button" className="topbar-back" onClick={onBack} aria-label={t('common.backToSubjects')}>
              ←
            </button>
          )}
          <div className="topbar-title-block">
            {title && <p className="topbar-title">{title}</p>}
            {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
          </div>
        </div>
        <div className="topbar-actions">
          {username && <p className="topbar-username">@{username}</p>}
          <div className="topbar-buttons">
            {onNotifications && (
              <button type="button" className="btn btn-ghost btn-icon topbar-icon-btn" onClick={onNotifications} aria-label={t('common.notificationsLabel')}>
                🔔
                {unreadCount > 0 && <span className="topbar-badge">{unreadCount}</span>}
              </button>
            )}
            {onSettings && (
              <button type="button" className="btn btn-ghost btn-icon" onClick={onSettings} aria-label={t('common.settingsLabel')}>
                ⚙️
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-small" onClick={onLogout}>
              {t('common.logOut')}
            </button>
          </div>
        </div>
      </div>
      <PremiumFeatureBanner subscriptionStatus={subscriptionStatus} daysRemainingInTrial={daysRemainingInTrial} />
    </header>
  )
}
