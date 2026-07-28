import { useState } from 'react'
import { login } from '../../lib/storage'
import SocialLoginButtons from './SocialLoginButtons'

export default function LoginForm({ onAuth }) {
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
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <SocialLoginButtons onError={setError} />

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
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? 'Logging in…' : 'Log In'}
      </button>
    </form>
  )
}
