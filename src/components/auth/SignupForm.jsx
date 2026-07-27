import { useState } from 'react'
import { createUser, findUserByUsername, findUserByParentCode, linkParentAndStudent, createSession } from '../../lib/storage'
import { generateParentCode } from '../../lib/codes'

export default function SignupForm({ onAuth }) {
  const [role, setRole] = useState('student')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [grade, setGrade] = useState('')
  const [parentCode, setParentCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      if (await findUserByUsername(trimmedUsername)) {
        setError('That username is already taken.')
        return
      }

      let linkedParent = null
      if (role === 'student' && parentCode.trim()) {
        linkedParent = await findUserByParentCode(parentCode)
        if (!linkedParent) {
          setError('That parent code was not found.')
          return
        }
      }

      const newUser = await createUser({
        username: trimmedUsername,
        password,
        accountType: role,
        grade: role === 'student' && grade ? Number(grade) : null,
        parentCode: role === 'parent' ? await generateParentCode() : null,
      })

      if (linkedParent) {
        await linkParentAndStudent(linkedParent.id, newUser.id)
      }

      await createSession(newUser.id)
      onAuth(newUser)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="role-toggle">
        <button
          type="button"
          className={`role-btn ${role === 'student' ? 'role-btn--active' : ''}`}
          onClick={() => setRole('student')}
        >
          🎓 Student
        </button>
        <button
          type="button"
          className={`role-btn ${role === 'parent' ? 'role-btn--active' : ''}`}
          onClick={() => setRole('parent')}
        >
          👪 Parent
        </button>
      </div>

      <div className="field">
        <label htmlFor="signup-username">Username</label>
        <input
          id="signup-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
      </div>
      <div className="field">
        <label htmlFor="signup-password">Password</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div className="field">
        <label htmlFor="signup-confirm">Confirm password</label>
        <input
          id="signup-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      {role === 'student' && (
        <>
          <div className="field">
            <label htmlFor="signup-grade">Grade (optional)</label>
            <input
              id="signup-grade"
              type="number"
              min="1"
              max="12"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>
          <div className="field">
            <label htmlFor="signup-parent-code">Parent code (optional)</label>
            <input
              id="signup-parent-code"
              value={parentCode}
              onChange={(e) => setParentCode(e.target.value.toUpperCase())}
              placeholder="e.g. 7F3K9Q"
              maxLength={6}
            />
            <p className="field-hint">Ask your parent for the code on their dashboard.</p>
          </div>
        </>
      )}

      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  )
}
