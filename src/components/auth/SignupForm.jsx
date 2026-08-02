import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { signup, updateUserProfile, checkEmailAvailable, linkParentByCode } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'
import LegalModal from '../legal/LegalModal'
import AccountTypeSelector from './AccountTypeSelector'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// This form's own copy comes from the global translation files
// (auth.signup.*) via react-i18next. The `lang`/`onLangChange` props are
// kept only for AccountTypeSelector.jsx (shared with OAuthOnboardingScreen,
// out of scope here — its own OPTIONS object still only has en/fr copy and
// falls back to English for 'es', a known gap). handleLangChange below
// drives both: onLangChange keeps AccountTypeSelector in sync, and
// i18n.changeLanguage keeps this form's own t()-driven text in sync.
export default function SignupForm({ lang, onLangChange, onAuth, onBack, onSwitchToLogin, initialParentCode = '', initialEmail = '' }) {
  const { t, i18n } = useTranslation()

  function handleLangChange(code) {
    onLangChange(code)
    i18n.changeLanguage(code)
  }

  // Covers arriving here with `lang` already set by SignupChooser's own
  // toggle (which only calls onLangChange, not i18n.changeLanguage) — keeps
  // this form's own t()-driven text in sync with whatever language its
  // toggle shows as active, even on first render.
  useEffect(() => {
    if (i18n.language !== lang) i18n.changeLanguage(lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  const [accountType, setAccountType] = useState('student')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [grade, setGrade] = useState('')
  const [parentCode, setParentCode] = useState(initialParentCode)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [confirmedAge, setConfirmedAge] = useState(false)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [openLegal, setOpenLegal] = useState(null) // null | 'privacy' | 'terms'

  const needsAgeConfirmation = accountType === 'student'
  const canSubmit = agreedToTerms && (!needsAgeConfirmation || confirmedAge) && !submitting

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setErrorCode('')

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3) {
      setError(t('auth.signup.errorUsername'))
      return
    }
    const trimmedEmail = email.trim()
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError(t('auth.signup.errorEmail'))
      return
    }
    if (password.length < 4) {
      setError(t('auth.signup.errorPassword'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('auth.signup.errorPasswordMatch'))
      return
    }
    if (!agreedToTerms) {
      setError(t('auth.signup.errorAgreeTerms'))
      return
    }
    if (needsAgeConfirmation && !confirmedAge) {
      setError(t('auth.signup.errorAgeConfirmation'))
      return
    }

    setSubmitting(true)
    try {
      // Checked here, before signup() creates the account, rather than
      // only in the follow-up updateUserProfile call below — signup.js
      // never collects email itself (see that call's comment), so without
      // this pre-check a duplicate email would only surface after an
      // account already exists with no email attached. update-settings.js
      // still re-checks authoritatively (catches the rare race against
      // another signup finishing in between).
      await checkEmailAvailable(trimmedEmail)

      const newUser = await signup({
        username: trimmedUsername,
        password,
        accountType,
        grade: accountType === 'student' && grade ? Number(grade) : null,
        parentCode: accountType === 'student' ? parentCode : null,
      })

      // signup.js itself is off-limits to changes, so email never goes
      // through it — this follow-up call is what actually saves the email
      // and (via update-settings.js's email-change detection) triggers the
      // verification send. The rest of newUser's own fields have to be
      // passed back through too: update-settings.js overwrites every field
      // it's given, so omitting them would null out the grade/parent-code
      // signup just set.
      let finalUser = newUser
      try {
        finalUser = await updateUserProfile(newUser.id, {
          displayName: newUser.display_name,
          email: trimmedEmail,
          schoolName: newUser.school,
          avatar: newUser.avatar,
          grade: newUser.grade,
          languagePreference: newUser.language_preference,
        })
      } catch (emailErr) {
        console.error('[Signup] failed to save email:', emailErr)
        // Don't block account creation — the user can re-enter it in Settings.
      }

      // signup.js's own parent_code handling above already created the
      // parent_student link (if any) — this call is purely for the side
      // effects signup.js can't perform itself (see link-parent.js's own
      // comment): notifying the parent, and marking a matching email
      // invitation accepted. Never allowed to block account creation.
      if (accountType === 'student' && parentCode) {
        try {
          await linkParentByCode(parentCode)
        } catch (linkErr) {
          console.error('[Signup] parent-link side effects failed:', linkErr)
        }
      }

      onAuth(finalUser)
    } catch (err) {
      setError(getErrorMessage(err, t, 'auth.signup.errorFallback'))
      setErrorCode(err.code || '')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-back-row">
        <button type="button" className="auth-link-btn" onClick={onBack}>
          {t('auth.signup.back')}
        </button>
      </div>

      <div className="signup-lang-toggle" role="group" aria-label="Language">
        <div className="lang-toggle">
          <button
            type="button"
            className={`lang-toggle-btn ${lang === 'en' ? 'lang-toggle-btn--active' : ''}`}
            onClick={() => handleLangChange('en')}
          >
            English
          </button>
          <button
            type="button"
            className={`lang-toggle-btn ${lang === 'fr' ? 'lang-toggle-btn--active' : ''}`}
            onClick={() => handleLangChange('fr')}
          >
            Français
          </button>
          <button
            type="button"
            className={`lang-toggle-btn ${lang === 'es' ? 'lang-toggle-btn--active' : ''}`}
            onClick={() => handleLangChange('es')}
          >
            Español
          </button>
        </div>
      </div>

      <AccountTypeSelector value={accountType} onChange={setAccountType} lang={lang} />

      <div className="field">
        <label htmlFor="signup-username">{t('auth.signup.username')}</label>
        <input
          id="signup-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
      </div>
      <div className="field">
        <label htmlFor="signup-email">{t('auth.signup.email')}</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="field">
        <label htmlFor="signup-password">{t('auth.signup.password')}</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div className="field">
        <label htmlFor="signup-confirm">{t('auth.signup.confirmPassword')}</label>
        <input
          id="signup-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      {accountType === 'student' && (
        <>
          <div className="field">
            <label htmlFor="signup-grade">{t('auth.signup.grade')}</label>
            <select id="signup-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">{t('auth.signup.selectGrade')}</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
              <option value="11">11</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="signup-parent-code">{t('auth.signup.parentCode')}</label>
            <input
              id="signup-parent-code"
              value={parentCode}
              onChange={(e) => setParentCode(e.target.value.toUpperCase())}
              placeholder={t('auth.signup.parentCodePlaceholder')}
              maxLength={6}
            />
            <p className="field-hint">{t('auth.signup.parentCodeHint')}</p>
          </div>
        </>
      )}

      <label className="checkbox-field">
        <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
        <span>
          {t('auth.signup.agreeToPrefix')}{' '}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              setOpenLegal('terms')
            }}
          >
            {t('auth.signup.termsOfService')}
          </button>{' '}
          {t('auth.signup.and')}{' '}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              setOpenLegal('privacy')
            }}
          >
            {t('auth.signup.privacyPolicy')}
          </button>
        </span>
      </label>

      {needsAgeConfirmation && (
        <label className="checkbox-field">
          <input type="checkbox" checked={confirmedAge} onChange={(e) => setConfirmedAge(e.target.checked)} />
          <span>{t('auth.signup.ageConfirmation')}</span>
        </label>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit}>
        {submitting ? t('auth.signup.creatingAccount') : t('auth.signup.createAccount')}
      </button>

      {error && (
        <p className="form-error">
          {error}
          {errorCode === 'EMAIL_EXISTS' && (
            <>
              {' '}
              <button type="button" className="auth-link-btn" onClick={onSwitchToLogin}>
                {t('auth.signup.logInInstead')}
              </button>
            </>
          )}
        </p>
      )}

      {openLegal && <LegalModal type={openLegal} onClose={() => setOpenLegal(null)} />}
    </form>
  )
}
