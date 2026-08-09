import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Logo from '../shared/Logo'
import PrivacyPolicyContent from './PrivacyPolicyContent'
import TermsOfServiceContent from './TermsOfServiceContent'
import DataDeletionContent from './DataDeletionContent'

const CONTENT_BY_TYPE = {
  privacy: PrivacyPolicyContent,
  terms: TermsOfServiceContent,
  'data-deletion': DataDeletionContent,
}

const TITLE_KEY_BY_TYPE = {
  privacy: 'landing.privacyPolicy',
  terms: 'landing.termsOfService',
  'data-deletion': 'landing.dataDeletion',
}

// Rendered by App.jsx for the /privacy, /terms, and /data-deletion paths —
// same window.location.pathname check as /verify, /reset-password, etc.
// These need to survive a hard browser navigation with no session at all
// (an external link from Facebook's App Settings, a search result, a
// logged-out visitor), unlike LegalModal.jsx (used from the landing page,
// signup form, and Settings), which stays a same-page modal so agreeing to
// the Terms during signup never navigates away from the form. Both read
// from the same *Content components, so the wording only lives in one
// place; this is just a different shell around it.
//
// This modal's own lang toggle is deliberately independent of the app's
// global i18n.language (used only to seed its initial value) — same
// rationale as LegalModal.jsx's own comment.
export default function LegalPage({ type }) {
  const { t, i18n } = useTranslation()
  const [lang, setLang] = useState(() => (['en', 'fr', 'es'].includes(i18n.language) ? i18n.language : 'en'))
  const Content = CONTENT_BY_TYPE[type]

  return (
    <div className="legal-page">
      <div className="legal-page-card">
        <div className="legal-page-header">
          <Logo size="small" onClick={() => window.location.assign('/')} />
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

        <h1 className="legal-page-title">{t(TITLE_KEY_BY_TYPE[type])}</h1>

        <Content lang={lang} />

        <a href="/" className="btn btn-secondary btn-block legal-page-back">
          {t('landing.backToZyndal')}
        </a>
      </div>
    </div>
  )
}
