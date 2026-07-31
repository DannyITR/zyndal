import { useEffect, useState } from 'react'
import { validateResetToken, resetPassword } from '../../lib/storage'
import Logo from '../shared/Logo'

// Same domain zyndal.ca is attached to as VerifyEmailScreen.jsx uses.
const GO_TO_URL = 'https://zyndal.ca'

// Rendered by App.jsx for the /reset-password path — same
// window.location.pathname check as /verify and /auth/callback, since
// this link has to survive a hard browser navigation from the reset
// email. Unlike VerifyEmailScreen.jsx, there's no onVerified/auto-login
// callback here at all — a password reset deliberately does not log the
// person in (see the success state below); it just points them at
// zyndal.ca to log in fresh with the new password.
export default function ResetPasswordScreen() {
  const [status, setStatus] = useState('validating') // validating | valid | invalid | success
  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setStatus('invalid')
      return
    }

    let cancelled = false
    validateResetToken(token)
      .then((data) => {
        if (cancelled) return
        if (data.valid) {
          setUsername(data.username || '')
          setStatus('valid')
        } else {
          setStatus('invalid')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('invalid')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    const token = new URLSearchParams(window.location.search).get('token')
    setSubmitting(true)
    try {
      await resetPassword(token, newPassword)
      // Strips the token so a refresh after success can't re-validate an
      // already-used token and confusingly show "invalid" instead.
      window.history.replaceState({}, '', '/reset-password')
      setStatus('success')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Logo size="large" />

        {status === 'validating' && <p className="auth-tagline">Checking your reset link…</p>}

        {status === 'invalid' && (
          <>
            <p className="auth-tagline">❌ This reset link has expired or is invalid. Request a new one.</p>
            <a href={GO_TO_URL} className="btn btn-primary btn-block">
              Go to Zyndal →
            </a>
          </>
        )}

        {status === 'valid' && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <p className="auth-tagline">Choose a new password{username ? ` for @${username}` : ''}.</p>

            <div className="field">
              <label htmlFor="reset-new-password">New password</label>
              <input
                id="reset-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="reset-confirm-password">Confirm password</label>
              <input
                id="reset-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset Password'}
            </button>

            {error && <p className="form-error">{error}</p>}
          </form>
        )}

        {status === 'success' && (
          <>
            <p className="auth-tagline">✅ Password reset successfully!</p>
            <a href={GO_TO_URL} className="btn btn-primary btn-block">
              Log in to Zyndal →
            </a>
          </>
        )}
      </div>
    </div>
  )
}
