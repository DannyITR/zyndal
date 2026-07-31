import { useState } from 'react'
import { requestPasswordReset } from '../../lib/storage'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// One of AuthScreen.jsx's `view` steps — reached from LoginForm's "Forgot
// password?" link. api/auth/request-password-reset.js always returns the
// same response regardless of whether the email matches an account (see
// its comment), so `submitted` flips to true unconditionally on any
// successful call; the only things that land in `error` instead are a
// malformed email or a real network failure, neither of which leaks
// whether an account exists.
export default function ForgotPasswordScreen({ onBack }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim()
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      await requestPasswordReset(trimmedEmail)
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="auth-form">
        <p className="auth-tagline">If an account exists with that email, you'll receive a reset link shortly.</p>
        <div className="auth-back-row">
          <button type="button" className="auth-link-btn" onClick={onBack}>
            ← Back to log in
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-back-row">
        <button type="button" className="auth-link-btn" onClick={onBack}>
          ← Back
        </button>
      </div>

      <div className="field">
        <label htmlFor="forgot-email">Email</label>
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
        {submitting ? 'Sending…' : 'Send reset link'}
      </button>

      {error && <p className="form-error">{error}</p>}
    </form>
  )
}
