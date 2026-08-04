import { useTranslation } from 'react-i18next'

// The one shared "you hit a Premium wall" modal — triggered reactively
// from every gated feature (Study Guide, Test Prep, Upload, My Uploads,
// Practice, the parent Finance screen, the student Wallet page) and from
// tapping the trial countdown banner. No Stripe integration yet, so
// "Upgrade to Premium" is a mailto: link, not a real checkout — that's
// the literal spec ("disabled for now — links to hello@zyndal.ca until
// Stripe is ready"), read as "the real purchase flow is disabled" rather
// than "make the button inert," since a genuinely disabled dead-end
// button here would be worse than just emailing support.
//
// Dismissal is recorded (zyndal_premium_modal_dismissed_at) per the
// spec's "show reminder again after 24 hours if dismissed" — but nothing
// in this codebase proactively re-shows this modal outside of a user
// tapping a gated feature again, so there's no "wait 24h before nagging"
// gate to apply here; tapping a locked feature always shows it
// immediately (silently no-op'ing a button tap would be worse UX than a
// modal appearing again sooner than 24h). The timestamp is stored so a
// future proactive-reminder feature has something to check.
export default function UpgradeModal({ onClose }) {
  const { t } = useTranslation()

  function handleDismiss() {
    try {
      localStorage.setItem('zyndal_premium_modal_dismissed_at', String(Date.now()))
    } catch {
      // Best-effort — a failed write just means no future feature can read
      // this dismissal time back; the modal itself still closes fine.
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleDismiss}>
      <div className="modal-card premium-modal" onClick={(e) => e.stopPropagation()}>
        <p className="premium-modal-emoji">👑</p>
        <h2 className="modal-title">{t('upgrade.title')}</h2>
        <p className="premium-modal-body">{t('upgrade.body')}</p>
        <p className="premium-modal-pricing">{t('upgrade.pricing')}</p>

        <a
          href="mailto:hello@zyndal.ca?subject=Zyndal%20Premium"
          className="btn btn-primary btn-block"
        >
          {t('upgrade.upgradeCta')}
        </a>
        <button type="button" className="btn btn-ghost btn-block" onClick={handleDismiss}>
          {t('upgrade.maybeLater')}
        </button>
      </div>
    </div>
  )
}
