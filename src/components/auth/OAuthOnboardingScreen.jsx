import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateUserProfile, getSchools } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'
import Logo from '../shared/Logo'
import AccountTypeSelector from './AccountTypeSelector'

// Shown once, immediately after api/auth/oauth-callback.js auto-creates a
// brand-new account (is_new_user: true) — Google only hands over a name and
// email, so this is where the things Zyndal actually needs (account type,
// and grade for students) get collected before the person ever sees the
// home screen. Saves via the same update-settings.js call
// SettingsScreen.jsx uses later, just with account_type included this one
// time (see that endpoint's comment). Teacher is fully selectable here and
// treated identically to parent downstream — see App.jsx's comment.
export default function OAuthOnboardingScreen({ user, onDone }) {
  const { t } = useTranslation()
  const [grade, setGrade] = useState('')
  const [schools, setSchools] = useState([])
  const [schoolId, setSchoolId] = useState('')
  const [otherSchoolName, setOtherSchoolName] = useState('')
  const [accountType, setAccountType] = useState('student')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSchools()
      .then((data) => setSchools(data.schools))
      .catch(() => {})
  }, [])

  const canSubmit = accountType !== 'student' || Boolean(grade)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!canSubmit) {
      setError(t('auth.onboarding.selectGradeRequired'))
      return
    }
    setSaving(true)
    try {
      const isOtherSchool = accountType === 'student' && schoolId === 'other'
      const updated = await updateUserProfile(user.id, {
        displayName: user.display_name,
        email: user.email,
        schoolName: isOtherSchool ? otherSchoolName.trim() || null : user.school,
        schoolId: accountType === 'student' && schoolId && !isOtherSchool ? schoolId : null,
        avatar: user.avatar,
        grade: accountType === 'student' ? Number(grade) : null,
        languagePreference: user.language_preference,
        accountType,
      })
      onDone(updated)
    } catch (err) {
      setError(getErrorMessage(err, t))
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
          <AccountTypeSelector value={accountType} onChange={setAccountType} />

          {accountType === 'student' && (
            <>
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
              <div className="field">
                <label htmlFor="onboarding-school">School</label>
                <select id="onboarding-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                  <option value="">Select your school</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="other">Other / not listed</option>
                </select>
                {schoolId === 'other' && (
                  <input
                    value={otherSchoolName}
                    onChange={(e) => setOtherSchoolName(e.target.value)}
                    placeholder="School name"
                  />
                )}
              </div>
            </>
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
