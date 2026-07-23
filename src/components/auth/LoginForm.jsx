import { useState } from 'react'
import { findUserByUsername, setSession } from '../../lib/storage'

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
      const user = await findUserByUsername(username)
      if (!user || user.password !== password) {
        setError('Invalid username or password.')
        return
      }
      setSession(user.id)
      onAuth(user)
    } catch {
      setError('Something went wrong. Please try again.')
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
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? 'Logging in…' : 'Log In'}
      </button>
    </form>
  )
}
