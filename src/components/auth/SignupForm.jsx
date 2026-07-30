import { useState } from 'react'
import { signup, updateUserProfile } from '../../lib/storage'
import LegalModal from '../legal/LegalModal'
import AccountTypeSelector from './AccountTypeSelector'

// Bilingual UI strings for this form only (not a general i18n system — see
// PrivacyPolicyContent/TermsOfServiceContent for the same EN/FR pattern
// applied to the legal pages). Account-type copy (student/parent/teacher
// labels+descriptions) lives in AccountTypeSelector.jsx instead, since that
// component is shared with OAuthOnboardingScreen. Server-side validation
// error messages (thrown from signup()) are shown as-is, in whatever
// language the API returned them in, since the API itself is English-only
// today.
const STRINGS = {
  en: {
    back: '← Back',
    username: 'Username',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    grade: 'Grade (optional)',
    selectGrade: 'Select grade',
    parentCode: 'Parent code (optional)',
    parentCodePlaceholder: 'e.g. 7F3K9Q',
    parentCodeHint: 'Ask your parent for the code on their dashboard.',
    agreeToPrefix: 'I agree to the',
    termsOfService: 'Terms of Service',
    and: 'and',
    privacyPolicy: 'Privacy Policy',
    ageConfirmation: 'I confirm I am 14 or older, or my parent has given permission',
    createAccount: 'Create Account',
    creatingAccount: 'Creating account…',
    errorUsername: 'Username must be at least 3 characters.',
    errorEmail: 'A valid email is required.',
    errorPassword: 'Password must be at least 4 characters.',
    errorPasswordMatch: 'Passwords do not match.',
    errorAgreeTerms: 'You must agree to the Terms of Service and Privacy Policy to create an account.',
    errorAgeConfirmation: 'Please confirm the age/parental permission statement below.',
    errorFallback: 'Something went wrong. Please try again.',
  },
  fr: {
    back: '← Retour',
    username: "Nom d'utilisateur",
    email: 'Courriel',
    password: 'Mot de passe',
    confirmPassword: 'Confirmer le mot de passe',
    grade: 'Niveau scolaire (optionnel)',
    selectGrade: 'Sélectionner un niveau',
    parentCode: 'Code parent (optionnel)',
    parentCodePlaceholder: 'ex. 7F3K9Q',
    parentCodeHint: 'Demandez à votre parent le code sur son tableau de bord.',
    agreeToPrefix: "J'accepte les",
    termsOfService: "Conditions d'utilisation",
    and: 'et la',
    privacyPolicy: 'Politique de confidentialité',
    ageConfirmation: "Je confirme que j'ai 14 ans ou plus, ou que mon parent m'a donné sa permission",
    createAccount: 'Créer un compte',
    creatingAccount: 'Création du compte…',
    errorUsername: "Le nom d'utilisateur doit contenir au moins 3 caractères.",
    errorEmail: 'Une adresse courriel valide est requise.',
    errorPassword: 'Le mot de passe doit contenir au moins 4 caractères.',
    errorPasswordMatch: 'Les mots de passe ne correspondent pas.',
    errorAgreeTerms: "Vous devez accepter les Conditions d'utilisation et la Politique de confidentialité pour créer un compte.",
    errorAgeConfirmation: 'Veuillez confirmer la déclaration d\'âge/permission parentale ci-dessous.',
    errorFallback: 'Une erreur est survenue. Veuillez réessayer.',
  },
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SignupForm({ lang, onLangChange, onAuth, onBack }) {
  const t = STRINGS[lang]

  const [accountType, setAccountType] = useState('student')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [grade, setGrade] = useState('')
  const [parentCode, setParentCode] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [confirmedAge, setConfirmedAge] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [openLegal, setOpenLegal] = useState(null) // null | 'privacy' | 'terms'

  const needsAgeConfirmation = accountType === 'student'
  const canSubmit = agreedToTerms && (!needsAgeConfirmation || confirmedAge) && !submitting

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3) {
      setError(t.errorUsername)
      return
    }
    const trimmedEmail = email.trim()
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError(t.errorEmail)
      return
    }
    if (password.length < 4) {
      setError(t.errorPassword)
      return
    }
    if (password !== confirmPassword) {
      setError(t.errorPasswordMatch)
      return
    }
    if (!agreedToTerms) {
      setError(t.errorAgreeTerms)
      return
    }
    if (needsAgeConfirmation && !confirmedAge) {
      setError(t.errorAgeConfirmation)
      return
    }

    setSubmitting(true)
    try {
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
      onAuth(finalUser)
    } catch (err) {
      setError(err.message || t.errorFallback)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-back-row">
        <button type="button" className="auth-link-btn" onClick={onBack}>
          {t.back}
        </button>
      </div>

      <div className="signup-lang-toggle" role="group" aria-label="Language">
        <div className="lang-toggle">
          <button
            type="button"
            className={`lang-toggle-btn ${lang === 'en' ? 'lang-toggle-btn--active' : ''}`}
            onClick={() => onLangChange('en')}
          >
            English
          </button>
          <button
            type="button"
            className={`lang-toggle-btn ${lang === 'fr' ? 'lang-toggle-btn--active' : ''}`}
            onClick={() => onLangChange('fr')}
          >
            Français
          </button>
        </div>
      </div>

      <AccountTypeSelector value={accountType} onChange={setAccountType} lang={lang} />

      <div className="field">
        <label htmlFor="signup-username">{t.username}</label>
        <input
          id="signup-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
      </div>
      <div className="field">
        <label htmlFor="signup-email">{t.email}</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="field">
        <label htmlFor="signup-password">{t.password}</label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div className="field">
        <label htmlFor="signup-confirm">{t.confirmPassword}</label>
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
            <label htmlFor="signup-grade">{t.grade}</label>
            <select id="signup-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">{t.selectGrade}</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
              <option value="11">11</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="signup-parent-code">{t.parentCode}</label>
            <input
              id="signup-parent-code"
              value={parentCode}
              onChange={(e) => setParentCode(e.target.value.toUpperCase())}
              placeholder={t.parentCodePlaceholder}
              maxLength={6}
            />
            <p className="field-hint">{t.parentCodeHint}</p>
          </div>
        </>
      )}

      <label className="checkbox-field">
        <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
        <span>
          {t.agreeToPrefix}{' '}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              setOpenLegal('terms')
            }}
          >
            {t.termsOfService}
          </button>{' '}
          {t.and}{' '}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              setOpenLegal('privacy')
            }}
          >
            {t.privacyPolicy}
          </button>
        </span>
      </label>

      {needsAgeConfirmation && (
        <label className="checkbox-field">
          <input type="checkbox" checked={confirmedAge} onChange={(e) => setConfirmedAge(e.target.checked)} />
          <span>{t.ageConfirmation}</span>
        </label>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit}>
        {submitting ? t.creatingAccount : t.createAccount}
      </button>

      {error && <p className="form-error">{error}</p>}

      {openLegal && <LegalModal type={openLegal} onClose={() => setOpenLegal(null)} />}
    </form>
  )
}
