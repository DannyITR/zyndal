import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { languageCodeForPreference } from '../../lib/i18n'
import { getErrorMessage } from '../../lib/errors'
import { AVATARS } from '../../lib/avatars'
import TopBar from './TopBar'
import LegalModal from '../legal/LegalModal'
import DeleteAccountModal from './DeleteAccountModal'

const DEFAULT_NOTIFICATION_PREFERENCES = { enabled: true, score_share: true, friend_request: true, streak_reminder: true }

export default function SettingsScreen({ user, onBack, onLogout, onSaved, onLogoClick }) {
  const { t, i18n } = useTranslation()
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
      setJoinError(getErrorMessage(err, t, 'settings.joinClassFailed'))
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
      setLinkParentSuccess(t('settings.linkedSuccess', { username: parent.username }))
    } catch (err) {
      setLinkParentError(getErrorMessage(err, t, 'settings.linkParentFailed'))
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
        if (accepted) setLinkParentSuccess(t('settings.linkedSuccess', { username: accepted.parentUsername }))
      }
      loadPendingParentRequests()
    } catch (err) {
      setRespondError(getErrorMessage(err, t, 'settings.respondRequestFailed'))
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
      setExportError(getErrorMessage(err, t, 'settings.downloadFailed'))
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

  // Switches the UI language the moment it's picked, ahead of (and
  // independent of) the profile form's own Save button below — the
  // database write still only happens on submit, same as every other field
  // on this form.
  function handleLanguageChange(e) {
    const preference = e.target.value
    setLanguagePreference(preference)
    i18n.changeLanguage(languageCodeForPreference(preference))
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
      setSuccess(t('settings.saved'))
    } catch (err) {
      console.error('[Settings] profile save failed:', err)
      setError(getErrorMessage(err, t, 'settings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (newPassword.length < 4) {
      setPasswordError(t('settings.passwordTooShort'))
      return
    }
    setPasswordSaving(true)
    try {
      await changePassword(user.id, currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setPasswordSuccess(t('settings.passwordUpdated'))
    } catch (err) {
      console.error('[Settings] password change failed:', err)
      setPasswordError(getErrorMessage(err, t, 'settings.passwordUpdateFailed'))
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="screen">
      <TopBar
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        username={user.username}
        onBack={onBack}
        onLogout={onLogout}
        onLogoClick={onLogoClick}
      />

      {isStudent && friendCount !== null && (
        <p className="friend-count-line">
          {t('settings.friendCountPrefix')} <strong>{friendCount}</strong> {t('settings.friendCountSuffix', { count: friendCount })}
        </p>
      )}

      <form className="auth-form" onSubmit={handleSaveProfile}>
        <div className="field">
          <label>{t('settings.profilePicture')}</label>
          <div className="avatar-grid">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                className={`avatar-option ${avatar === a ? 'avatar-option--selected' : ''}`}
                onClick={() => setAvatar(a)}
                aria-label={t('settings.chooseAvatar', { avatar: a })}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="settings-display-name">{t('settings.displayName')}</label>
          <input
            id="settings-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('settings.displayNamePlaceholder')}
          />
        </div>

        <div className="field">
          <label htmlFor="settings-email">{t('settings.emailAddress')}</label>
          <input
            id="settings-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('settings.emailPlaceholder')}
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="settings-school">{t('settings.schoolName')}</label>
          <input
            id="settings-school"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder={t('settings.schoolPlaceholder')}
          />
        </div>

        {isStudent && (
          <div className="field">
            <label htmlFor="settings-grade">{t('settings.grade')}</label>
            <select id="settings-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">{t('settings.selectGrade')}</option>
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
            <label htmlFor="settings-language">{t('settings.preferredLanguage')}</label>
            <select id="settings-language" value={languagePreference} onChange={handleLanguageChange}>
              <option value="English">English</option>
              <option value="French">Français</option>
              <option value="Spanish">Español</option>
            </select>
            <p className="field-hint">{t('settings.languageHint')}</p>
          </div>
        )}

        {isStudent && (
          <div className="field">
            <h3 className="section-heading">{t('settings.notificationsHeading')}</h3>
            <p className="field-hint">{t('settings.notificationsHint')}</p>
            <label className="checkbox-field">
              <input type="checkbox" checked={notificationPrefs.enabled} onChange={() => toggleNotificationPref('enabled')} />
              <span>{t('settings.pushNotifications')}</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={notificationPrefs.score_share}
                onChange={() => toggleNotificationPref('score_share')}
                disabled={!notificationPrefs.enabled}
              />
              <span>{t('settings.notifScoreShare')}</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={notificationPrefs.friend_request}
                onChange={() => toggleNotificationPref('friend_request')}
                disabled={!notificationPrefs.enabled}
              />
              <span>{t('settings.notifFriendRequest')}</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={notificationPrefs.streak_reminder}
                onChange={() => toggleNotificationPref('streak_reminder')}
                disabled={!notificationPrefs.enabled}
              />
              <span>{t('settings.notifStreakReminder')}</span>
            </label>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          {saving ? t('settings.saving') : t('settings.saveChanges')}
        </button>
      </form>

      <form className="auth-form" onSubmit={handleChangePassword}>
        <h3 className="section-heading">{t('settings.changePassword')}</h3>
        <div className="field">
          <label htmlFor="settings-current-password">{t('settings.currentPassword')}</label>
          <input
            id="settings-current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="field">
          <label htmlFor="settings-new-password">{t('settings.newPassword')}</label>
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
          {passwordSaving ? t('settings.updating') : t('settings.changePassword')}
        </button>
      </form>

      {isStudent && pendingParentRequests && pendingParentRequests.length > 0 && (
        <div className="finance-section-card">
          <h3 className="section-heading">{t('settings.pendingParentRequests')}</h3>
          <p className="field-hint">{t('settings.parentWantsLink')}</p>
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
                    {t('common.accept')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    disabled={respondingRequestId === req.id}
                    onClick={() => handleRespondParentRequest(req.id, false)}
                  >
                    {t('common.decline')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isStudent && (
        <div className="finance-section-card">
          <h3 className="section-heading">{t('settings.linkToParent')}</h3>
          <p className="field-hint">{t('settings.enterParentCode')}</p>
          <form className="auth-form" onSubmit={handleLinkParent}>
            <div className="field">
              <label htmlFor="settings-parent-code">{t('settings.parentCode')}</label>
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
              {linkParentSaving ? t('settings.linking') : t('settings.linkParent')}
            </button>
          </form>
        </div>
      )}

      {isStudent && (
        <div className="finance-section-card">
          <h3 className="section-heading">{t('settings.joinClass')}</h3>
          <p className="field-hint">{t('settings.enterClassCode')}</p>
          <form className="auth-form" onSubmit={handleJoinClass}>
            <div className="field">
              <label htmlFor="settings-teacher-code">{t('settings.classCode')}</label>
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
              {joinSaving ? t('settings.joining') : t('settings.joinClassBtn')}
            </button>
          </form>

          {joinedClasses && joinedClasses.length > 0 && (
            <div className="teacher-student-list">
              {joinedClasses.map((c) => (
                <div key={c.id} className="finance-student-row">
                  <div>
                    <p className="finance-student-name">{c.name}</p>
                    <p className="finance-student-detail">
                      {t('settings.classDetail', { grade: c.grade, school: c.school, teacher: c.teacherUsername })}
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
          {t('landing.privacyPolicy')}
        </button>
        <button type="button" onClick={() => setOpenLegal('terms')}>
          {t('landing.termsOfService')}
        </button>
      </div>

      <div className="settings-danger-zone">
        <button type="button" className="btn btn-secondary btn-block" disabled={exporting} onClick={handleExport}>
          {exporting ? t('settings.preparingDownload') : t('settings.downloadData')}
        </button>
        {exportError && <p className="form-error">{exportError}</p>}

        <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setShowDeleteModal(true)}>
          {t('deleteAccount.title')}
        </button>
      </div>

      {openLegal && <LegalModal type={openLegal} onClose={() => setOpenLegal(null)} />}
      {showDeleteModal && <DeleteAccountModal onConfirm={handleDeleteAccount} onClose={() => setShowDeleteModal(false)} />}
    </div>
  )
}
