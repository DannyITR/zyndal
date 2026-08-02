import { useEffect, useState } from 'react'
import {
  updateUserProfile,
  changePassword,
  getFriendCount,
  exportMyData,
  deleteAccount,
  getMyClasses,
  joinClass,
  linkParentByCode,
  getPendingParentRequests,
  respondToParentLinkRequest,
} from '../../lib/storage'
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

  const [joinedClasses, setJoinedClasses] = useState(null)
  const [teacherCodeInput, setTeacherCodeInput] = useState('')
  const [joinSaving, setJoinSaving] = useState(false)
  const [joinError, setJoinError] = useState('')

  function loadJoinedClasses() {
    getMyClasses()
      .then((data) => setJoinedClasses(data.classes))
      .catch(() => setJoinedClasses([]))
  }

  useEffect(() => {
    if (!isStudent) return
    loadJoinedClasses()
  }, [isStudent])

  async function handleJoinClass(e) {
    e.preventDefault()
    setJoinError('')
    if (!teacherCodeInput.trim()) return
    setJoinSaving(true)
    try {
      await joinClass(teacherCodeInput.trim())
      setTeacherCodeInput('')
      loadJoinedClasses()
    } catch (err) {
      setJoinError(err.message || "Couldn't join that class. Please check the code and try again.")
    } finally {
      setJoinSaving(false)
    }
  }

  const [parentCodeInput, setParentCodeInput] = useState('')
  const [linkParentSaving, setLinkParentSaving] = useState(false)
  const [linkParentError, setLinkParentError] = useState('')
  const [linkParentSuccess, setLinkParentSuccess] = useState('')

  const [pendingParentRequests, setPendingParentRequests] = useState(null)
  const [respondingRequestId, setRespondingRequestId] = useState(null)
  const [respondError, setRespondError] = useState('')

  function loadPendingParentRequests() {
    getPendingParentRequests()
      .then((data) => setPendingParentRequests(data.requests))
      .catch(() => setPendingParentRequests([]))
  }

  useEffect(() => {
    if (!isStudent) return
    loadPendingParentRequests()
  }, [isStudent])

  async function handleLinkParent(e) {
    e.preventDefault()
    setLinkParentError('')
    setLinkParentSuccess('')
    if (!parentCodeInput.trim()) return
    setLinkParentSaving(true)
    try {
      const { parent } = await linkParentByCode(parentCodeInput.trim())
      setParentCodeInput('')
      setLinkParentSuccess(`✅ Linked to @${parent.username} successfully!`)
    } catch (err) {
      setLinkParentError(err.message || "Couldn't link that code. Please check it and try again.")
    } finally {
      setLinkParentSaving(false)
    }
  }

  async function handleRespondParentRequest(requestId, accept) {
    if (respondingRequestId) return
    setRespondError('')
    setRespondingRequestId(requestId)
    try {
      await respondToParentLinkRequest(requestId, accept)
      if (accept) {
        const accepted = pendingParentRequests?.find((r) => r.id === requestId)
        if (accepted) setLinkParentSuccess(`✅ Linked to @${accepted.parentUsername} successfully!`)
      }
      loadPendingParentRequests()
    } catch (err) {
      setRespondError(err.message || "Couldn't update this request. Please try again.")
    } finally {
      setRespondingRequestId(null)
    }
  }

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

      {isStudent && pendingParentRequests && pendingParentRequests.length > 0 && (
        <div className="finance-section-card">
          <h3 className="section-heading">Pending Parent Requests</h3>
          <p className="field-hint">A parent wants to link their account to yours.</p>
          {respondError && <p className="form-error">{respondError}</p>}
          <div className="teacher-student-list">
            {pendingParentRequests.map((req) => (
              <div key={req.id} className="finance-student-row">
                <p className="finance-student-name">
                  {req.parentAvatar ? `${req.parentAvatar} ` : ''}@{req.parentUsername}
                </p>
                <div className="notification-item-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    disabled={respondingRequestId === req.id}
                    onClick={() => handleRespondParentRequest(req.id, true)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    disabled={respondingRequestId === req.id}
                    onClick={() => handleRespondParentRequest(req.id, false)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isStudent && (
        <div className="finance-section-card">
          <h3 className="section-heading">Link to a Parent</h3>
          <p className="field-hint">Enter the code your parent shared with you.</p>
          <form className="auth-form" onSubmit={handleLinkParent}>
            <div className="field">
              <label htmlFor="settings-parent-code">Parent code</label>
              <input
                id="settings-parent-code"
                value={parentCodeInput}
                onChange={(e) => setParentCodeInput(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
              />
            </div>
            {linkParentError && <p className="form-error">{linkParentError}</p>}
            {linkParentSuccess && <p className="form-success">{linkParentSuccess}</p>}
            <button type="submit" className="btn btn-secondary btn-block" disabled={linkParentSaving}>
              {linkParentSaving ? 'Linking…' : 'Link Parent'}
            </button>
          </form>
        </div>
      )}

      {isStudent && (
        <div className="finance-section-card">
          <h3 className="section-heading">Join a Class</h3>
          <p className="field-hint">Enter the 6-character code your teacher shared with you. You can join more than one class.</p>
          <form className="auth-form" onSubmit={handleJoinClass}>
            <div className="field">
              <label htmlFor="settings-teacher-code">Class code</label>
              <input
                id="settings-teacher-code"
                value={teacherCodeInput}
                onChange={(e) => setTeacherCodeInput(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
              />
            </div>
            {joinError && <p className="form-error">{joinError}</p>}
            <button type="submit" className="btn btn-secondary btn-block" disabled={joinSaving}>
              {joinSaving ? 'Joining…' : 'Join Class'}
            </button>
          </form>

          {joinedClasses && joinedClasses.length > 0 && (
            <div className="teacher-student-list">
              {joinedClasses.map((c) => (
                <div key={c.id} className="finance-student-row">
                  <div>
                    <p className="finance-student-name">{c.name}</p>
                    <p className="finance-student-detail">
                      Grade {c.grade} · {c.school} · Taught by @{c.teacherUsername}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
