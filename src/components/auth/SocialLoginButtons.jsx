import { useState } from 'react'
import { supabaseAuth } from '../../lib/supabaseAuthClient'

// Shared by LoginForm.jsx and SignupChooser.jsx, for every account type
// (there's no per-account-type login/signup screen in this app — Teacher is
// picked post-auth on OAuthOnboardingScreen.jsx, same as it already is for
// Google). Facebook was previously removed only because it wasn't wired up
// to a real Supabase provider yet ("showing a dead button wasn't worth the
// confusion") — both api/auth/oauth-callback.js and the oauth_identities
// table's own check constraint already special-case 'facebook' by name, so
// this restores the button rather than introducing new backend support.
// "Continue with Email" isn't OAuth at all — it just tells the parent to
// move to the next step (see onContinueWithEmail below). LoginForm shows
// its username/password fields immediately rather than gating them behind
// a "choose" step, so it doesn't pass onContinueWithEmail — that button
// only renders when the prop is actually given (SignupChooser.jsx).
const STRINGS = {
  en: {
    google: 'Continue with Google',
    facebook: 'Continue with Facebook',
    email: 'Continue with Email',
    redirecting: 'Redirecting…',
    error: 'Could not start sign-in. Please try again.',
  },
  fr: {
    google: 'Continuer avec Google',
    facebook: 'Continuer avec Facebook',
    email: 'Continuer avec e-mail',
    redirecting: 'Redirection…',
    error: 'Impossible de démarrer la connexion. Veuillez réessayer.',
  },
  es: {
    google: 'Continuar con Google',
    facebook: 'Continuar con Facebook',
    email: 'Continuar con correo electrónico',
    redirecting: 'Redirigiendo…',
    error: 'No se pudo iniciar el inicio de sesión. Inténtalo de nuevo.',
  },
}

// See https://zyndal.ca/auth/callback — App.jsx renders OAuthCallbackScreen
// for this exact path (no client-side router in this app; see App.jsx's
// window.location.pathname check). REDIRECT_URL below is built from
// window.location.origin at runtime, not hardcoded, so this works
// identically whether reached via zyndal.ca, zyndal.vercel.app, or
// localhost — this comment just documents the production case.
const REDIRECT_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#fff"
        d="M18 9a9 9 0 1 0-10.4 8.9v-6.3H5.3V9h2.3V7c0-2.3 1.35-3.55 3.44-3.55.99 0 2.03.18 2.03.18v2.24h-1.14c-1.13 0-1.48.7-1.48 1.42V9h2.52l-.4 2.6h-2.12v6.3A9 9 0 0 0 18 9Z"
      />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="1.5" y="3.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 4.5 9 9.5l6.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function SocialLoginButtons({ lang = 'en', onError, onContinueWithEmail }) {
  const t = STRINGS[lang] || STRINGS.en
  const [redirecting, setRedirecting] = useState(null) // null | 'google' | 'facebook'

  async function handleOAuth(provider) {
    onError?.('')
    setRedirecting(provider)
    const { error } = await supabaseAuth.auth.signInWithOAuth({
      provider,
      options: { redirectTo: REDIRECT_URL },
    })
    if (error) {
      setRedirecting(null)
      onError?.(t.error)
    }
    // On success the browser navigates away to the provider immediately — nothing left to do here.
  }

  return (
    <div className="social-login">
      <button
        type="button"
        className="btn social-btn social-btn--google"
        disabled={redirecting !== null}
        onClick={() => handleOAuth('google')}
      >
        <GoogleIcon />
        {redirecting === 'google' ? t.redirecting : t.google}
      </button>
      <button
        type="button"
        className="btn social-btn social-btn--facebook"
        disabled={redirecting !== null}
        onClick={() => handleOAuth('facebook')}
      >
        <FacebookIcon />
        {redirecting === 'facebook' ? t.redirecting : t.facebook}
      </button>
      {onContinueWithEmail && (
        <button type="button" className="btn social-btn social-btn--email" disabled={redirecting !== null} onClick={onContinueWithEmail}>
          <EmailIcon />
          {t.email}
        </button>
      )}
    </div>
  )
}
