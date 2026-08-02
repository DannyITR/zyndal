import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PrivacyPolicyContent from './PrivacyPolicyContent'
import TermsOfServiceContent from './TermsOfServiceContent'

// One modal for both legal pages — used from the landing page footer, the
// signup form (so agreeing to the Terms/Privacy Policy never navigates the
// visitor away from the signup form they're mid-filling), and Settings.
// The app has no client-side router, so this stands in for a dedicated
// "page": full-length content in a large scrollable card rather than a
// small confirmation-style modal.
//
// This modal's own `lang` toggle is deliberately independent of the app's
// global i18n.language (used only to seed its initial value) — a student
// reading the app in French should still be able to switch to reading the
// Terms in English without that also flipping the rest of the UI's
// language, and vice versa.
export default function LegalModal({ type, onClose }) {
  const { t, i18n } = useTranslation()
  const [lang, setLang] = useState(() => (['en', 'fr', 'es'].includes(i18n.language) ? i18n.language : 'en'))
  const isPrivacy = type === 'privacy'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card legal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="legal-modal-header">
          <h2 className="modal-title">{isPrivacy ? t('landing.privacyPolicy') : t('landing.termsOfService')}</h2>
          <div className="lang-toggle" role="group" aria-label="Language">
            <button
              type="button"
              className={`lang-toggle-btn ${lang === 'en' ? 'lang-toggle-btn--active' : ''}`}
              onClick={() => setLang('en')}
            >
              English
            </button>
            <button
              type="button"
              className={`lang-toggle-btn ${lang === 'fr' ? 'lang-toggle-btn--active' : ''}`}
              onClick={() => setLang('fr')}
            >
              Français
            </button>
            <button
              type="button"
              className={`lang-toggle-btn ${lang === 'es' ? 'lang-toggle-btn--active' : ''}`}
              onClick={() => setLang('es')}
            >
              Español
            </button>
          </div>
        </div>

        <div className="legal-modal-body">
          {isPrivacy ? <PrivacyPolicyContent lang={lang} /> : <TermsOfServiceContent lang={lang} />}
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
