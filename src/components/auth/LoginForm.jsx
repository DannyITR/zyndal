import { useState } from 'react'
import { login } from '../../lib/storage'
import SocialLoginButtons from './SocialLoginButtons'

// Unlike SignupForm's two-step "choose a path, then see the form" flow,
// login shows its fields immediately — there's no separate account-type/
// grade collection step here, so gating the fields behind a "Continue with
// Email" click would just be an extra tap for no reason. Google stays
// available below the fields for existing Google-linked accounts; see
// AuthScreen.jsx's `view` state machine for how this fits into the wider
// login/signup-choice/signup-form/Google-onboarding flow.
export default function LoginForm({ onAuth, onSwitchToSignup }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForgotNote, setShowForgotNote] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = await login(username, password)
      onAuth(user)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="login-username">Username</label>
        <input
          id="login-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      <div className="auth-forgot-row">
        <button type="button" className="auth-link-btn" onClick={() => setShowForgotNote(true)}>
          Forgot password?
        </button>
      </div>
      {showForgotNote && <p className="auth-forgot-note">Password reset isn't available yet — please contact support.</p>}

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? 'Logging in…' : 'Log In'}
      </button>

      <SocialLoginButtons onError={setError} />

      {error && <p className="form-error">{error}</p>}

      <div className="auth-switch-row">
        Don't have an account?{' '}
        <button type="button" className="auth-link-btn" onClick={onSwitchToSignup}>
          Sign Up
        </button>
      </div>
    </form>
  )
}
