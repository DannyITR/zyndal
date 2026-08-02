import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { login } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'
import SocialLoginButtons from './SocialLoginButtons'

// Unlike SignupForm's two-step "choose a path, then see the form" flow,
// login shows its fields immediately — there's no separate account-type/
// grade collection step here, so gating the fields behind a "Continue with
// Email" click would just be an extra tap for no reason. Google stays
// available below the fields for existing Google-linked accounts; see
// AuthScreen.jsx's `view` state machine for how this fits into the wider
// login/signup-choice/signup-form/Google-onboarding flow.
export default function LoginForm({ onAuth, onSwitchToSignup, onForgotPassword }) {
  const { t, i18n } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = await login(username, password)
      onAuth(user)
    } catch (err) {
      setError(getErrorMessage(err, t, 'auth.login.errorFallback'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="login-username">{t('auth.login.username')}</label>
        <input
          id="login-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="login-password">{t('auth.login.password')}</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <div className="auth-forgot-row">
        <button type="button" className="auth-link-btn" onClick={onForgotPassword}>
          {t('auth.login.forgotPassword')}
        </button>
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? t('auth.login.loggingIn') : t('auth.login.logIn')}
      </button>

      <SocialLoginButtons lang={i18n.language} onError={setError} />

      {error && <p className="form-error">{error}</p>}

      <div className="auth-switch-row">
        {t('auth.login.noAccount')}{' '}
        <button type="button" className="auth-link-btn" onClick={onSwitchToSignup}>
          {t('auth.login.signUp')}
        </button>
      </div>
    </form>
  )
}
