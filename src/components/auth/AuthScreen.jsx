import { useState } from 'react'
import Logo from '../shared/Logo'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'

export default function AuthScreen({ initialMode = 'login', onAuth, onLogoClick }) {
  const [mode, setMode] = useState(initialMode)

  return (
    <div className="auth-screen">
      <div className="auth-screen-corner">
        <Logo size="small" onClick={onLogoClick} />
      </div>

      <div className="auth-card">
        <Logo size="large" />
        <p className="auth-tagline">Level up every subject, one day at a time.</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
            onClick={() => setMode('login')}
          >
            Log In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'auth-tab--active' : ''}`}
            onClick={() => setMode('signup')}
          >
            Sign Up
          </button>
        </div>

        {mode === 'login' ? (
          <LoginForm onAuth={onAuth} />
        ) : (
          <SignupForm onAuth={onAuth} />
        )}
      </div>
    </div>
  )
}
