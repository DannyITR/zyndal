import { useTranslation } from 'react-i18next'
import { formatLongDate, SCORE_COLORS, todayStr } from '../../../lib/streak'
import { getUserTimeZone } from '../../../lib/timezone'

// Read-only view of a friend's daily score card — opened from the home
// screen's incoming-share notification box, the Friends screen's badge, and
// the Notifications page's score_share "View" action. Reuses the same
// .share-card markup ShareStreakScreen renders for the logged-in user's own
// card, just populated with the friend's data instead. No XP line — none of
// the three call sites' data sources include the friend's XP.
export default function FriendScoreCardModal({ share, onClose }) {
  const { t } = useTranslation()
  const today = todayStr(new Date(), getUserTimeZone())
  const { correct, total } = share.senderScore
  // Scaled proportionally against the day's actual max (total) rather than a
  // fixed clamp, so a full score always lands on the gradient's green end —
  // see ShareStreakScreen.jsx's identical fix for the logged-in user's own card.
  const scoreColor = SCORE_COLORS[Math.round((Math.min(Math.max(correct, 0), total) / total) * (SCORE_COLORS.length - 1))]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-card--friend-score" onClick={(e) => e.stopPropagation()}>
        <div className="share-card">
          <div className="share-card-glow share-card-glow--1" />
          <div className="share-card-glow share-card-glow--2" />

          <div className="share-card-top">
            <span className="share-card-bolt">⚡</span>
            <span className="share-card-brand">Zyndal</span>
            <span className="share-card-bolt share-card-bolt--mirror" aria-hidden="true">
              ⚡
            </span>
          </div>

          <div className="share-card-middle">
            <p className="share-card-date">{formatLongDate(today)}</p>
            <p className="share-card-score" style={{ color: scoreColor }}>
              {correct}/{total}
            </p>
            <p className="share-card-username">@{share.senderUsername}</p>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
