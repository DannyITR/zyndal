import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  updateUserProfile,
  updateThemePreference,
  changePassword,
  getFriendCount,
  exportMyData,
  deleteAccount,
  getMyClasses,
  joinClass,
  linkParentByCode,
  getPendingParentRequests,
  respondToParentLinkRequest,
  getLinkedParents,
  openCustomerPortal,
  getSchools,
  setStudentSchool,
} from '../../lib/storage'
import { languageCodeForPreference } from '../../lib/i18n'
import { useTheme } from '../../lib/ThemeContext'
import { THEMES, THEME_PREVIEW_COLORS } from '../../lib/theme'
import { getErrorMessage } from '../../lib/errors'
import { PREMIUM_ENFORCEMENT_ENABLED } from '../../lib/premium'
import { AVATARS } from '../../lib/avatars'
import TopBar from './TopBar'
import LegalModal from '../legal/LegalModal'
import DeleteAccountModal from './DeleteAccountModal'
import UpgradeModal from './UpgradeModal'

const DEFAULT_NOTIFICATION_PREFERENCES = { enabled: true, score_share: true, friend_request: true, streak_reminder: true, poke: true }

const RENEWAL_DATE_LOCALE = { en: 'en-US', fr: 'fr-CA', es: 'es-ES' }
function formatRenewalDate(iso, language) {
  const locale = RENEWAL_DATE_LOCALE[language] || 'en-US'
  return new Date(iso).toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })
}

// THEMES' values ('default'/'midnight'/'daylight') to their translation
// keys — kept as camelCase literals here (matching every other key in
// translation.json) rather than building the key string dynamically from
// the theme value itself.
const THEME_LABEL_KEYS = { default: 'settings.themeDefault', midnight: 'settings.themeMidnight', daylight: 'settings.themeDaylight' }

export default function SettingsScreen({ user, onBack, onLogout, onSaved, onLogoClick }) {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
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

  // Structured school reference — separate from the free-text `schoolName`
  // field below (which stays as the "Other/not listed" fallback and, for
  // students, is hidden from the main profile form in favor of this
  // section, so the two never appear side by side meaning the same thing).
  const [schools, setSchools] = useState([])
  const [schoolPickerId, setSchoolPickerId] = useState('')
  const [schoolOtherName, setSchoolOtherName] = useState('')
  const [schoolSaving, setSchoolSaving] = useState(false)
  const [schoolError, setSchoolError] = useState('')
  const [schoolSuccess, setSchoolSuccess] = useState('')

  useEffect(() => {
    if (!isStudent) return
    getSchools()
      .then((data) => setSchools(data.schools))
      .catch(() => {})
  }, [isStudent])

  // Only meaningful once user.school_id is set — schools may still be
  // loading, so this can briefly be undefined even then.
  const currentSchoolName = user.school_id ? schools.find((s) => s.id === user.school_id)?.name : null

  async function handleSetSchool(e) {
    e.preventDefault()
    setSchoolError('')
    setSchoolSuccess('')
    const isOtherSchool = schoolPickerId === 'other'
    if (!schoolPickerId || (isOtherSchool && !schoolOtherName.trim())) return
    setSchoolSaving(true)
    try {
      const updated = await setStudentSchool({
        schoolId: isOtherSchool ? null : schoolPickerId,
        schoolName: isOtherSchool ? schoolOtherName.trim() : null,
      })
      onSaved(updated)
      setSchoolSuccess(t('settings.schoolSaved'))
    } catch (err) {
      setSchoolError(getErrorMessage(err, t, 'settings.schoolSaveFailed'))
    } finally {
      setSchoolSaving(false)
    }
  }

  const [parentCodeInput, setParentCodeInput] = useState('')
  const [linkParentSaving, setLinkParentSaving] = useState(false)
  const [linkParentError, setLinkParentError] = useState('')
  const [linkParentSuccess, setLinkParentSuccess] = useState('')

  const [pendingParentRequests, setPendingParentRequests] = useState(null)
  const [respondingRequestId, setRespondingRequestId] = useState(null)
  const [respondError, setRespondError] = useState('')

  // Read-only — nothing here lets the student unlink from their end.
  const [linkedParents, setLinkedParents] = useState(null)

  function loadLinkedParents() {
    getLinkedParents()
      .then((data) => setLinkedParents(data.parents))
      .catch(() => setLinkedParents([]))
  }

  useEffect(() => {
    if (!isStudent) return
    loadLinkedParents()
  }, [isStudent])

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
      loadLinkedParents()
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
        loadLinkedParents()
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
  const [themeError, setThemeError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const [openLegal, setOpenLegal] = useState(null) // null | 'privacy' | 'terms'

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const [showSubscriptionUpgradeModal, setShowSubscriptionUpgradeModal] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState('')

  // "Manage subscription" is only ever rendered for the actual Stripe
  // customer (user.is_subscription_owner) — a student whose Premium came
  // from a linked parent's plan has no billing account of their own to
  // manage (see api/stripe/customer-portal.js's own 400 guard, which this
  // mirrors client-side to avoid a round trip that can only fail).
  async function handleManageSubscription() {
    setPortalError('')
    setPortalLoading(true)
    try {
      const { portal_url: portalUrl } = await openCustomerPortal()
      window.location.href = portalUrl
    } catch (err) {
      console.error('[Settings] failed to open customer portal:', err)
      setPortalError(getErrorMessage(err, t, 'settings.subscriptionPortalFailed'))
      setPortalLoading(false)
    }
  }

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

  // Unlike language above, a theme change persists immediately rather than
  // waiting for the profile form's Save button — expected behavior for a
  // theme switcher (flip it, see it, done). setTheme's own DOM/localStorage
  // application never fails, so a failed DB sync (rare — network hiccup)
  // only surfaces as themeError below; the visual choice still sticks on
  // this device either way.
  async function handleSelectTheme(value) {
    setTheme(value)
    setThemeError('')
    try {
      await updateThemePreference(value)
    } catch (err) {
      console.error('[Settings] theme save failed:', err)
      setThemeError(getErrorMessage(err, t, 'settings.themeSaveFailed'))
    }
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
        // Students edit school through the dedicated "School" section
        // instead (its own save action) — leaving this undefined here means
        // update-settings.js won't touch it from this form for them.
        schoolName: isStudent ? undefined : schoolName.trim(),
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

        {/* Students set their school via the structured "School" section
            below instead — this free-text field stays for parents/teachers. */}
        {!isStudent && (
          <div className="field">
            <label htmlFor="settings-school">{t('settings.schoolName')}</label>
            <input
              id="settings-school"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder={t('settings.schoolPlaceholder')}
            />
          </div>
        )}

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

        <div className="field">
          <label>{t('settings.appearance')}</label>
          <div className="theme-grid">
            {THEMES.map((value) => (
              <button
                key={value}
                type="button"
                className={`theme-option ${theme === value ? 'theme-option--selected' : ''}`}
                onClick={() => handleSelectTheme(value)}
              >
                <span
                  className="theme-option-swatch"
                  style={{ background: `linear-gradient(135deg, ${THEME_PREVIEW_COLORS[value][0]} 50%, ${THEME_PREVIEW_COLORS[value][1]} 50%)` }}
                  aria-hidden="true"
                />
                {t(THEME_LABEL_KEYS[value])}
              </button>
            ))}
          </div>
          {themeError && <p className="form-error">{themeError}</p>}
        </div>

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
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={notificationPrefs.poke}
                onChange={() => toggleNotificationPref('poke')}
                disabled={!notificationPrefs.enabled}
              />
              <span>{t('settings.notifPoke')}</span>
            </label>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          {saving ? t('settings.saving') : t('settings.saveChanges')}
        </button>
      </form>

      {isStudent && (
        <div className="finance-section-card">
          <h3 className="section-heading">{t('settings.linkedParentsHeading')}</h3>
          {linkedParents === null ? (
            <p className="field-hint">{t('common.loading')}</p>
          ) : linkedParents.length === 0 ? (
            <p className="field-hint">{t('settings.noLinkedParents')}</p>
          ) : (
            <div className="teacher-student-list">
              {linkedParents.map((p) => (
                <p key={p.id} className="finance-student-name">
                  {p.avatar ? `${p.avatar} ` : '👨‍👩‍👧 '}@{p.username} ({t('settings.parentLabel')})
                </p>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Temporary promo switch (see src/lib/premium.js) — the whole
          subscription-status card (trial countdown, Upgrade Now, Manage
          Subscription, Family-plan copy) is hidden while this is off. */}
      {PREMIUM_ENFORCEMENT_ENABLED && (
      <div className="finance-section-card">
        <h3 className="section-heading">{t('settings.subscriptionHeading')}</h3>
        {user.account_type === 'teacher' ? (
          // Teachers get subscription_status: 'premium' from
          // getSubscriptionStatus (see api/_lib/subscription.js) same as a
          // real subscriber, but is_subscription_owner is never set for
          // them (they never actually go through Stripe) — checked first,
          // ahead of the subscription_status branches below, so they never
          // see the "via your parent's Family plan" copy that condition
          // would otherwise match.
          <p className="field-hint">{t('settings.subscriptionTeacherFree')}</p>
        ) : (
          <>
            {user.subscription_status === 'trial_active' && (
              <>
                <p className="field-hint">
                  {user.days_remaining_in_trial <= 1
                    ? t('settings.subscriptionTrialLastDay')
                    : t('settings.subscriptionTrialActive', { count: user.days_remaining_in_trial })}
                </p>
                <button type="button" className="btn btn-primary btn-block" onClick={() => setShowSubscriptionUpgradeModal(true)}>
                  {t('settings.subscriptionUpgradeNow')}
                </button>
              </>
            )}
            {user.subscription_status === 'premium' && user.is_subscription_owner && (
              <>
                <p className="field-hint">
                  {user.subscription_current_period_end
                    ? t('settings.subscriptionPremiumRenews', { date: formatRenewalDate(user.subscription_current_period_end, i18n.language) })
                    : t('settings.subscriptionPremiumActive')}
                </p>
                {portalError && <p className="form-error">{portalError}</p>}
                <button type="button" className="btn btn-secondary btn-block" disabled={portalLoading} onClick={handleManageSubscription}>
                  {portalLoading ? t('settings.subscriptionOpeningPortal') : t('settings.subscriptionManage')}
                </button>
              </>
            )}
            {user.subscription_status === 'premium' && !user.is_subscription_owner && (
              <p className="field-hint">
                {user.subscription_current_period_end
                  ? t('settings.subscriptionPremiumViaFamily', { date: formatRenewalDate(user.subscription_current_period_end, i18n.language) })
                  : t('settings.subscriptionPremiumViaFamilyNoDate')}
              </p>
            )}
            {(user.subscription_status === 'trial_expired' || user.subscription_status === 'free') && (
              <>
                <p className="field-hint">{t('settings.subscriptionFreePlan')}</p>
                <button type="button" className="btn btn-primary btn-block" onClick={() => setShowSubscriptionUpgradeModal(true)}>
                  {t('settings.subscriptionUpgradeNow')}
                </button>
              </>
            )}
          </>
        )}
      </div>
      )}

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
          <h3 className="section-heading">{t('settings.schoolHeading')}</h3>
          {user.school_id ? (
            <p className="field-hint">
              {t('settings.currentSchool', { school: currentSchoolName || t('common.loading') })}
            </p>
          ) : (
            <form className="auth-form" onSubmit={handleSetSchool}>
              <p className="field-hint">{t('settings.selectSchoolHint')}</p>
              <div className="field">
                <label htmlFor="settings-school-picker">{t('auth.signup.school')}</label>
                <select id="settings-school-picker" value={schoolPickerId} onChange={(e) => setSchoolPickerId(e.target.value)}>
                  <option value="">{t('auth.signup.selectSchool')}</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="other">{t('auth.signup.schoolOther')}</option>
                </select>
                {schoolPickerId === 'other' && (
                  <input
                    value={schoolOtherName}
                    onChange={(e) => setSchoolOtherName(e.target.value)}
                    placeholder={t('settings.schoolPlaceholder')}
                  />
                )}
              </div>
              {schoolError && <p className="form-error">{schoolError}</p>}
              {schoolSuccess && <p className="form-success">{schoolSuccess}</p>}
              <button type="submit" className="btn btn-secondary btn-block" disabled={schoolSaving}>
                {schoolSaving ? t('settings.saving') : t('settings.saveChanges')}
              </button>
            </form>
          )}
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
      {showSubscriptionUpgradeModal && <UpgradeModal user={user} onClose={() => setShowSubscriptionUpgradeModal(false)} />}
    </div>
  )
}
