import { useState } from 'react'
import SocialLoginButtons from './SocialLoginButtons'

// The "landing state" of the signup flow (see AuthScreen.jsx's `view`
// state machine) — just the language toggle and the two continue-with
// buttons, nothing else. AccountTypeSelector and the actual form fields
// only appear once "Continue with Email" is chosen, at which point
// AuthScreen swaps this component out for SignupForm.jsx entirely (rather
// than this component revealing more of itself), so the tabs above it can
// disappear too.
export default function SignupChooser({ lang, onLangChange, onContinueWithEmail }) {
  const [error, setError] = useState('')

  return (
    // .auth-form (not an actual <form> — nothing here submits) purely for
    // its width:100%/flex-column/gap layout, matching every other step's
    // sizing rather than shrinking to content width under .auth-card's own
    // align-items: center.
    <div className="auth-form">
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

      <SocialLoginButtons lang={lang} onError={setError} onContinueWithEmail={onContinueWithEmail} />

      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
