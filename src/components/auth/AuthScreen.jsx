import { useState } from 'react'
import Logo from '../shared/Logo'
import LoginForm from './LoginForm'
import SignupChooser from './SignupChooser'
import SignupForm from './SignupForm'

// Owns the auth flow's step state so each step can show only what belongs
// to it — the Log In/Sign Up tabs, in particular, only make sense while
// still choosing a path, not once inside a specific form (see LoginForm's
// and SignupForm's own comments). `lang` lives here rather than inside
// SignupChooser/SignupForm individually so the chosen language survives
// going back and forth between the signup-choice and signup-form steps.
export default function AuthScreen({ initialMode = 'login', onAuth, onLogoClick }) {
  const [view, setView] = useState(initialMode === 'signup' ? 'signupChoose' : 'login')
  const [lang, setLang] = useState('en')

  return (
    <div className="auth-screen">
      <div className="auth-screen-corner">
        <Logo size="small" onClick={onLogoClick} />
      </div>

      <div className="auth-card">
        <Logo size="large" />
        <p className="auth-tagline">Level up every subject, one day at a time.</p>

        {view === 'signupChoose' && (
          <div className="auth-tabs">
            <button type="button" className="auth-tab" onClick={() => setView('login')}>
              Log In
            </button>
            <button type="button" className="auth-tab auth-tab--active" onClick={() => setView('signupChoose')}>
              Sign Up
            </button>
          </div>
        )}

        {view === 'login' && <LoginForm onAuth={onAuth} onSwitchToSignup={() => setView('signupChoose')} />}

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
          />
        )}
      </div>
    </div>
  )
}
