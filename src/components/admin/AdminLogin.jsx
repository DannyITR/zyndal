import { useState } from 'react'
import { adminLogin } from '../../lib/adminApi'

export default function AdminLogin({ onLoggedIn }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      // adminLogin itself always sends username: 'admin' (see adminApi.js /
      // api/admin/auth.js) — this field exists so the form matches the
      // requested "username/password" shape, but the server never actually
      // branches on anything other than the fixed "admin" identity.
      if (username !== 'admin') throw new Error('Invalid admin credentials.')
      await adminLogin(password)
      onLoggedIn()
    } catch (err) {
      setError(err.message || 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-login-page">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <h1 className="admin-login-title">Zyndal Admin</h1>
        <label className="admin-field">
          <span>Username</span>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label className="admin-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        </label>
        {error && <p className="admin-error">{error}</p>}
        <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log In'}
        </button>
      </form>
    </div>
  )
}
