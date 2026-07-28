import { useState } from 'react'
import { updateUserProfile } from '../../lib/storage'
import Logo from '../shared/Logo'

// Shown once, immediately after api/auth/oauth-callback.js auto-creates a
// brand-new account (is_new_user: true) — Google/Facebook only hand over a
// name and email, so this is where the two things Zyndal actually needs
// (grade, and whether this is a student or parent account) get collected
// before the person ever sees the home screen. Saves via the same
// update-settings.js call SettingsScreen.jsx uses later, just with
// account_type included this one time (see that endpoint's comment).
export default function OAuthOnboardingScreen({ user, onDone }) {
  const [grade, setGrade] = useState('')
  const [accountType, setAccountType] = useState('student')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = accountType === 'parent' || Boolean(grade)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!canSubmit) {
      setError('Please select your grade.')
      return
    }
    setSaving(true)
    try {
      const updated = await updateUserProfile(user.id, {
        displayName: user.display_name,
        email: user.email,
        schoolName: user.school,
        avatar: user.avatar,
        grade: accountType === 'student' ? Number(grade) : null,
        languagePreference: user.language_preference,
      })
      onDone({ ...updated, account_type: accountType })
    } catch (err) {
      setError(err.message || "Couldn't save your info. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Logo size="large" />
        <h2 className="oauth-onboarding-title">Welcome to Zyndal!</h2>
        <p className="auth-tagline">Just a couple of things to get started.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>I am a</label>
            <div className="role-toggle">
              <button
                type="button"
                className={`role-btn ${accountType === 'student' ? 'role-btn--active' : ''}`}
                onClick={() => setAccountType('student')}
              >
                🎓 Student
              </button>
              <button
                type="button"
                className={`role-btn ${accountType === 'parent' ? 'role-btn--active' : ''}`}
                onClick={() => setAccountType('parent')}
              >
                👪 Parent
              </button>
            </div>
          </div>

          {accountType === 'student' && (
            <div className="field">
              <label htmlFor="onboarding-grade">Grade</label>
              <select id="onboarding-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">Select grade</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
                <option value="11">11</option>
              </select>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={saving || !canSubmit}>
            {saving ? 'Saving…' : "Let's go"}
          </button>
        </form>
      </div>
    </div>
  )
}
