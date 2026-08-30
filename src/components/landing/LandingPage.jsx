import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Logo from '../shared/Logo'
import LegalModal from '../legal/LegalModal'

export default function LandingPage({ onSignUp, onLogIn }) {
  const { t } = useTranslation()
  const [openLegal, setOpenLegal] = useState(null) // null | 'privacy' | 'terms'

  return (
    <div className="landing-screen">
      <div className="landing-glow landing-glow--1" aria-hidden="true" />
      <div className="landing-glow landing-glow--2" aria-hidden="true" />

      <div className="landing-hero">
        <Logo size="large" />
        <p className="landing-tagline">{t('landing.tagline')}</p>
        <p className="landing-description">{t('landing.description')}</p>
      </div>

      <div className="landing-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={onSignUp}>
          {t('landing.signUp')}
        </button>
        <button type="button" className="btn btn-secondary btn-block" onClick={onLogIn}>
          {t('landing.logIn')}
        </button>
      </div>

      <div className="landing-audiences">
        {['students', 'parents', 'teachers'].map((audience) => (
          <div key={audience} className={`landing-audience-card landing-audience-card--${audience}`}>
            <span className="landing-audience-label">{t(`landing.audiences.${audience}.label`)}</span>
            <h2 className="landing-audience-title">{t(`landing.audiences.${audience}.title`)}</h2>
            <p className="landing-audience-body">{t(`landing.audiences.${audience}.body`)}</p>
          </div>
        ))}
      </div>

      <footer className="landing-footer">
        <div className="landing-footer-links">
          <button type="button" onClick={() => setOpenLegal('privacy')}>
            {t('landing.privacyPolicy')}
          </button>
          <button type="button" onClick={() => setOpenLegal('terms')}>
            {t('landing.termsOfService')}
          </button>
          <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>
        </div>
        <p className="landing-footer-copyright">{t('landing.copyright')}</p>
      </footer>

      {openLegal && <LegalModal type={openLegal} onClose={() => setOpenLegal(null)} />}
    </div>
  )
}
