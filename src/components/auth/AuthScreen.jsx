import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Logo from '../shared/Logo'
import LoginForm from './LoginForm'
import SignupChooser from './SignupChooser'
import SignupForm from './SignupForm'
import ForgotPasswordScreen from './ForgotPasswordScreen'

// Owns the auth flow's step state so each step can show only what belongs
// to it — the Log In/Sign Up tabs, in particular, only make sense while
// still choosing a path, not once inside a specific form (see LoginForm's
// and SignupForm's own comments). `lang` lives here rather than inside
// SignupChooser/SignupForm individually so the chosen language survives
// going back and forth between the signup-choice and signup-form steps.
export default function AuthScreen({ initialMode = 'login', onAuth, onLogoClick, inviteParentCode, inviteEmail, inviteParentUsername }) {
  // An invite link skips the OAuth-or-email choice entirely and lands
  // straight on the form itself, prefilled — see SignupForm's own props
  // below and App.jsx's inviteParams. Google/Facebook signup has no
  // parent-code prefill path today (OAuthOnboardingScreen never collects
  // one), so a student who backs out of this form to try that route
  // instead just loses the prefill, same as if they'd never followed the
  // link.
  const { t, i18n } = useTranslation()
  const [view, setView] = useState(inviteParentCode ? 'signupForm' : initialMode === 'signup' ? 'signupChoose' : 'login')
  // Seeded from i18n.language (already resolved from a returning visitor's
  // localStorage/browser preference — see src/lib/i18n.js) rather than a
  // hardcoded 'en', so SignupForm's own toggle starts pre-selected on
  // whichever language the rest of the app is already showing.
  const [lang, setLang] = useState(() => i18n.language)

  return (
    <div className="auth-screen">
      <div className="auth-screen-corner">
        <Logo size="small" onClick={onLogoClick} />
      </div>

      <div className="auth-card">
        <Logo size="large" />
        <p className="auth-tagline">{t('auth.tagline')}</p>

        {inviteParentCode && inviteParentUsername && view === 'signupForm' && (
          <p className="auth-invite-banner">{t('auth.inviteBanner', { username: inviteParentUsername })}</p>
        )}

        {view === 'signupChoose' && (
          <div className="auth-tabs">
            <button type="button" className="auth-tab" onClick={() => setView('login')}>
              {t('auth.login.logIn')}
            </button>
            <button type="button" className="auth-tab auth-tab--active" onClick={() => setView('signupChoose')}>
              {t('auth.login.signUp')}
            </button>
          </div>
        )}

        {view === 'login' && (
          <LoginForm
            onAuth={onAuth}
            onSwitchToSignup={() => setView('signupChoose')}
            onForgotPassword={() => setView('forgotPassword')}
          />
        )}

        {view === 'forgotPassword' && <ForgotPasswordScreen onBack={() => setView('login')} />}

        {view === 'signupChoose' && (
          <SignupChooser lang={lang} onLangChange={setLang} onContinueWithEmail={() => setView('signupForm')} />
        )}

        {view === 'signupForm' && (
          <SignupForm
            lang={lang}
            onLangChange={setLang}
            onAuth={onAuth}
            onBack={() => setView('signupChoose')}
            onSwitchToLogin={() => setView('login')}
            initialParentCode={inviteParentCode || ''}
            initialEmail={inviteEmail || ''}
          />
        )}
      </div>
    </div>
  )
}
