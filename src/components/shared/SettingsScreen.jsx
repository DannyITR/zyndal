import { useEffect, useState } from 'react'
import { updateUserProfile, changePassword, getFriendCount, exportMyData, deleteAccount } from '../../lib/storage'
import { AVATARS } from '../../lib/avatars'
import TopBar from './TopBar'
import LegalModal from '../legal/LegalModal'
import DeleteAccountModal from './DeleteAccountModal'

const DEFAULT_NOTIFICATION_PREFERENCES = { enabled: true, score_share: true, friend_request: true, streak_reminder: true }

export default function SettingsScreen({ user, onBack, onLogout, onSaved, onLogoClick }) {
  const isStudent = user.account_type === 'student'

  const [friendCount, setFriendCount] = useState(null)

  useEffect(() => {
    if (!isStudent) return
    let cancelled = false
    getFriendCount(user.id).then((count) => {
      if (!cancelled) setFriendCount(count)
    })
    return () => {
      cancelled = true
    }
  }, [isStudent, user.id])

  const [avatar, setAvatar] = useState(user.avatar || AVATARS[0])
  const [displayName, setDisplayName] = useState(user.display_name || '')
  const [email, setEmail] = useState(user.email || '')
  const [schoolName, setSchoolName] = useState(user.school || '')
  const [grade, setGrade] = useState(user.grade ? String(user.grade) : '')
  const [languagePreference, setLanguagePreference] = useState(user.language_preference || 'English')
  const [notificationPrefs, setNotificationPrefs] = useState({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...(user.notification_preferences || {}) })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const [openLegal, setOpenLegal] = useState(null) // null | 'privacy' | 'terms'

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // fetch() with a custom X-Session-Token header can't trigger a native
  // browser download the way a plain link to the URL could — so this fetches
  // the JSON via the authenticated API call, then builds the download
  // client-side with a Blob + a synthetic, immediately-clicked <a download>.
  async function handleExport() {
    setExportError('')
    setExporting(true)
    try {
      const data = await exportMyData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'zyndal-my-data.json'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[Settings] data export failed:', err)
      setExportError(err.message || "Couldn't download your data. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  function toggleNotificationPref(key) {
    setNotificationPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleDeleteAccount() {
    await deleteAccount()
    setShowDeleteModal(false)
    onLogout()
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const updated = await updateUserProfile(user.id, {
        displayName: displayName.trim(),
        email: email.trim(),
        schoolName: schoolName.trim(),
        avatar,
        grade: isStudent ? (grade ? Number(grade) : null) : user.grade,
        languagePreference: isStudent ? languagePreference : user.language_preference,
        notificationPreferences: isStudent ? notificationPrefs : user.notification_preferences,
      })
      onSaved(updated)
      setSuccess('Saved!')
    } catch (err) {
      console.error('[Settings] profile save failed:', err)
      setError(err.message ? `Couldn't save your changes: ${err.message}` : "Couldn't save your changes. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters.')
      return
    }
    setPasswordSaving(true)
    try {
      await changePassword(user.id, currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setPasswordSuccess('Password updated!')
    } catch (err) {
      console.error('[Settings] password change failed:', err)
      setPasswordError(err.message || "Couldn't update your password. Please try again.")
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="screen">
      <TopBar
        title="⚙️ Settings"
        subtitle="Manage your profile"
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      {isStudent && friendCount !== null && (
        <p className="friend-count-line">
          You have <strong>{friendCount}</strong> friend{friendCount === 1 ? '' : 's'} on Zyndal
        </p>
      )}

      <form className="auth-form" onSubmit={handleSaveProfile}>
        <div className="field">
          <label>Profile picture</label>
          <div className="avatar-grid">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                className={`avatar-option ${avatar === a ? 'avatar-option--selected' : ''}`}
                onClick={() => setAvatar(a)}
                aria-label={`Choose ${a} avatar`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="settings-display-name">Display name</label>
          <input
            id="settings-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="What should we call you?"
          />
        </div>

        <div className="field">
          <label htmlFor="settings-email">Email address</label>
          <input
            id="settings-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="settings-school">School name</label>
          <input
            id="settings-school"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="e.g. Lincoln High School"
          />
        </div>

        {isStudent && (
          <div className="field">
            <label htmlFor="settings-grade">Grade</label>
            <select id="settings-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">Select grade</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
              <option value="11">11</option>
            </select>
          </div>
        )}

        {isStudent && (
          <div className="field">
            <label htmlFor="settings-language">Preferred language</label>
            <select id="settings-language" value={languagePreference} onChange={(e) => setLanguagePreference(e.target.value)}>
              <option value="English">English</option>
              <option value="French">French</option>
            </select>
            <p className="field-hint">Used for AI-generated study guide and test prep questions when you're not studying from your own uploads.</p>
          </div>
        )}

        {isStudent && (
          <div className="field">
            <h3 className="section-heading">Notifications</h3>
            <p className="field-hint">
              These control push alerts only — notifications always still appear in the app's bell icon regardless of these settings.
            </p>
            <label className="checkbox-field">
              <input type="checkbox" checked={notificationPrefs.enabled} onChange={() => toggleNotificationPref('enabled')} />
              <span>Push notifications</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={notificationPrefs.score_share}
                onChange={() => toggleNotificationPref('score_share')}
                disabled={!notificationPrefs.enabled}
              />
              <span>When a friend shares their score with me</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={notificationPrefs.friend_request}
                onChange={() => toggleNotificationPref('friend_request')}
                disabled={!notificationPrefs.enabled}
              />
              <span>When someone sends me a friend request</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={notificationPrefs.streak_reminder}
                onChange={() => toggleNotificationPref('streak_reminder')}
                disabled={!notificationPrefs.enabled}
              />
              <span>Streak at risk reminder (9pm if not answered today)</span>
            </label>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>

      <form className="auth-form" onSubmit={handleChangePassword}>
        <h3 className="section-heading">Change Password</h3>
        <div className="field">
          <label htmlFor="settings-current-password">Current password</label>
          <input
            id="settings-current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="field">
          <label htmlFor="settings-new-password">New password</label>
          <input
            id="settings-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {passwordError && <p className="form-error">{passwordError}</p>}
        {passwordSuccess && <p className="form-success">{passwordSuccess}</p>}
        <button type="submit" className="btn btn-secondary btn-block" disabled={passwordSaving}>
          {passwordSaving ? 'Updating…' : 'Change Password'}
        </button>
      </form>

      <div className="settings-legal-links">
        <button type="button" onClick={() => setOpenLegal('privacy')}>
          Privacy Policy
        </button>
        <button type="button" onClick={() => setOpenLegal('terms')}>
          Terms of Service
        </button>
      </div>

      <div className="settings-danger-zone">
        <button type="button" className="btn btn-secondary btn-block" disabled={exporting} onClick={handleExport}>
          {exporting ? 'Preparing download…' : '⬇️ Download my data'}
        </button>
        {exportError && <p className="form-error">{exportError}</p>}

        <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setShowDeleteModal(true)}>
          Delete My Account
        </button>
      </div>

      {openLegal && <LegalModal type={openLegal} onClose={() => setOpenLegal(null)} />}
      {showDeleteModal && <DeleteAccountModal onConfirm={handleDeleteAccount} onClose={() => setShowDeleteModal(false)} />}
    </div>
  )
}
