import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { requestPasswordReset } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// One of AuthScreen.jsx's `view` steps — reached from LoginForm's "Forgot
// password?" link. api/auth/request-password-reset.js always returns the
// same response regardless of whether the email matches an account (see
// its comment), so `submitted` flips to true unconditionally on any
// successful call; the only things that land in `error` instead are a
// malformed email or a real network failure, neither of which leaks
// whether an account exists.
export default function ForgotPasswordScreen({ onBack }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim()
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError(t('auth.forgotPassword.invalidEmail'))
      return
    }

    setSubmitting(true)
    try {
      await requestPasswordReset(trimmedEmail)
      setSubmitted(true)
    } catch (err) {
      setError(getErrorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="auth-form">
        <p className="auth-tagline">{t('auth.forgotPassword.checkEmail')}</p>
        <div className="auth-back-row">
          <button type="button" className="auth-link-btn" onClick={onBack}>
            {t('auth.forgotPassword.backToLogin')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-back-row">
        <button type="button" className="auth-link-btn" onClick={onBack}>
          {t('auth.signup.back')}
        </button>
      </div>

      <div className="field">
        <label htmlFor="forgot-email">{t('auth.signup.email')}</label>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
        />
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? t('common.sending') : t('auth.forgotPassword.sendResetLink')}
      </button>

      {error && <p className="form-error">{error}</p>}
    </form>
  )
}
