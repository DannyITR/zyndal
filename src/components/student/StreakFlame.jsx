import { useTranslation } from 'react-i18next'

export default function StreakFlame({ streak, onInfoClick }) {
  const { t } = useTranslation()
  return (
    <div className={`streak-pill ${streak > 0 ? 'streak-pill--lit' : ''}`}>
      <span className="streak-flame">🔥</span>
      <div className="streak-text">
        <span className="streak-count">{streak}</span>
        <span className="streak-label">{t('home.dayStreakLabel')}</span>
      </div>
      {onInfoClick && (
        <button type="button" className="info-badge" onClick={onInfoClick} aria-label={t('home.whatIsDayStreak')}>
          i
        </button>
      )}
    </div>
  )
}
