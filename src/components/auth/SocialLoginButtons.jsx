import { useState } from 'react'
import { supabaseAuth } from '../../lib/supabaseAuthClient'

// Shared by LoginForm.jsx and SignupForm.jsx — same three buttons either
// way, since "continue with Google" doesn't mean anything different between
// logging in and signing up (api/auth/oauth-callback.js decides which one
// actually happened server-side). `lang` is optional so LoginForm (which
// has no translation system of its own) can render this in English by
// default while SignupForm's existing EN/FR toggle still covers it.
const STRINGS = {
  en: {
    or: '— or —',
    google: 'Continue with Google',
    facebook: 'Continue with Facebook',
    snapchat: 'Continue with Snapchat',
    comingSoon: 'Coming soon',
    redirecting: 'Redirecting…',
  },
  fr: {
    or: '— ou —',
    google: 'Continuer avec Google',
    facebook: 'Continuer avec Facebook',
    snapchat: 'Continuer avec Snapchat',
    comingSoon: 'Bientôt disponible',
    redirecting: 'Redirection…',
  },
}

// See https://zyndal.vercel.app/auth/callback — App.jsx renders
// OAuthCallbackScreen for this exact path (no client-side router in this
// app; see App.jsx's window.location.pathname check).
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

function SnapchatIcon() {
  return <span aria-hidden="true">👻</span>
}

export default function SocialLoginButtons({ lang = 'en', onError }) {
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
      onError?.(error.message || 'Could not start sign-in. Please try again.')
    }
    // On success the browser navigates away to the provider immediately —
    // nothing left to do here.
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
      <button type="button" className="btn social-btn social-btn--snapchat" disabled title={t.comingSoon}>
        <SnapchatIcon />
        {t.snapchat}
      </button>

      <div className="social-login-divider">
        <span>{t.or}</span>
      </div>
    </div>
  )
}
