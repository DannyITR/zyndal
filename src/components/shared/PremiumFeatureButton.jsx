import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const LONG_PRESS_MS = 500

// Wraps every premium-gated feature button (StudentHome's Test Prep/Study
// Guide/Upload/My Uploads/Practice/My Grades, ParentDashboard's Finances)
// — centralized here since all of them need identical subscription_status-
// driven behavior. A premium/trial_active user gets a plain button with no
// crown at all, nothing locked to explain. A free/trial_expired user keeps
// the crown AND gets a themed tooltip explaining why, shown on hover
// (desktop, plain CSS :hover/:focus-visible) or long-press (mobile — no
// native equivalent, tracked here via touch timers).
export default function PremiumFeatureButton({ subscriptionStatus, onClick, className = 'btn btn-secondary btn-small', children }) {
  const { t } = useTranslation()
  const tooltipId = useId()
  const isPremiumUser = subscriptionStatus === 'premium' || subscriptionStatus === 'trial_active'
  const [longPressActive, setLongPressActive] = useState(false)
  const pressTimerRef = useRef(null)

  if (isPremiumUser) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {children}
      </button>
    )
  }

  function handleTouchStart() {
    pressTimerRef.current = setTimeout(() => setLongPressActive(true), LONG_PRESS_MS)
  }
  function handleTouchEnd() {
    clearTimeout(pressTimerRef.current)
    setLongPressActive(false)
  }

  return (
    <button
      type="button"
      className={`${className} btn--premium ${longPressActive ? 'btn--premium-tooltip-visible' : ''}`}
      onClick={onClick}
      aria-describedby={tooltipId}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <span className="premium-crown" aria-hidden="true">
        👑
      </span>
      {children}
      <span id={tooltipId} className="premium-tooltip" role="tooltip">
        {t('upgrade.premiumFeatureTooltip')}
      </span>
    </button>
  )
}
