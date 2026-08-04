import { useTranslation } from 'react-i18next'

// onClick (e.g. the Coins pill navigating to the Wallet page) wraps just
// the icon/value/label in a <button>, kept as a sibling of the info badge
// rather than an ancestor of it — nesting the info badge's own <button>
// inside another <button> would be invalid HTML and inconsistent across
// browsers for click handling.
export default function StatPill({ icon, label, value, onInfoClick, onClick }) {
  const { t } = useTranslation()
  const content = (
    <>
      <span className="stat-icon">{icon}</span>
      <div className="stat-text">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </>
  )
  return (
    <div className="stat-pill">
      {onClick ? (
        <button type="button" className="stat-pill-tap" onClick={onClick} aria-label={label}>
          {content}
        </button>
      ) : (
        content
      )}
      {onInfoClick && (
        <button type="button" className="info-badge" onClick={onInfoClick} aria-label={t('home.whatIsLabel', { label })}>
          i
        </button>
      )}
    </div>
  )
}
