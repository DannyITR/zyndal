import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabaseAuth } from '../../lib/supabaseAuthClient'
import { oauthCallback } from '../../lib/storage'
import { getErrorMessage } from '../../lib/errors'
import Logo from '../shared/Logo'
import OAuthMergeScreen from './OAuthMergeScreen'
import OAuthOnboardingScreen from './OAuthOnboardingScreen'

// Bug fix: Google/Supabase can redirect back here with an error instead of
// a session — e.g. the person denied consent, or (more relevant to the
// "white screen" report this was added for) Supabase's own Site
// URL/Redirect URLs allowlist doesn't include this exact origin, which
// makes Supabase itself bounce back with `?error=...`/`#error=...` rather
// than ever creating a session. supabase-js's own _initialize() already
// detects this internally (see node_modules/@supabase/auth-js's
// _getSessionFromURL), but it only logs it via a debug channel that's off
// by default and never surfaces through getSession() or
// onAuthStateChange() — from this component's old code, that failure mode
// was indistinguishable from "nothing happened yet", so it silently ate
// the full 10-second timeout below and then showed a generic message that
// threw away the actual reason. Checking the URL directly here — mirroring
// supabase-js's own parseParametersFromURL (hash params, then query params
// which take precedence) — catches it immediately instead.
function getUrlErrorParams() {
  const url = new URL(window.location.href)
  const params = {}
  if (url.hash && url.hash[0] === '#') {
    new URLSearchParams(url.hash.slice(1)).forEach((value, key) => {
      params[key] = value
    })
  }
  url.searchParams.forEach((value, key) => {
    params[key] = value
  })
  if (params.error || params.error_description || params.error_code) {
    return { error: params.error, description: params.error_description, code: params.error_code }
  }
  return null
}

// Rendered by App.jsx for the /auth/callback path (see the
// window.location.pathname check there — this app has no client-side
// router, so that's the closest thing to a "route" it has). Google/Facebook
// redirect the whole browser back here after the person approves sign-in;
// this screen's only job is turning that into a Zyndal login by calling
// api/auth/oauth-callback.js, then handing off to whichever of the three
// outcomes applies.
export default function OAuthCallbackScreen({ onAuth, onCancel }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState('loading') // loading | merge | onboarding | error
  const [mergeInfo, setMergeInfo] = useState(null)
  const [onboardingUser, setOnboardingUser] = useState(null)
  const [error, setError] = useState('')
  const handledRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    console.log('[OAuthCallback] mounted at', window.location.href)

    const urlError = getUrlErrorParams()
    if (urlError) {
      console.error('[OAuthCallback] provider/Supabase returned an error in the redirect URL:', urlError)
      handledRef.current = true
      setStatus('error')
      setError(urlError.description || t('auth.oauth.signInFailed', { reason: urlError.error || urlError.code || t('auth.oauth.unknownError') }))
      return
    }

    async function finishSignIn(session) {
      if (handledRef.current) return
      handledRef.current = true
      console.log('[OAuthCallback] session detected, resolving provider identity…')

      const provider = session.user?.app_metadata?.provider || session.user?.identities?.[0]?.provider
      if (provider !== 'google' && provider !== 'facebook') {
        console.error('[OAuthCallback] unsupported or missing provider on session:', provider, session.user)
        if (!cancelled) {
          setStatus('error')
          setError(t('auth.oauth.unsupportedProvider'))
        }
        return
      }

      console.log('[OAuthCallback] provider =', provider, '— calling api/auth/oauth-callback')
      try {
        const result = await oauthCallback({ provider, supabaseAccessToken: session.access_token })
        if (cancelled) return
        console.log('[OAuthCallback] api/auth/oauth-callback succeeded:', {
          needsMerge: Boolean(result.needs_merge),
          isNewUser: Boolean(result.is_new_user),
        })

        if (result.needs_merge) {
          setMergeInfo({ ...result, supabaseAccessToken: session.access_token })
          setStatus('merge')
        } else if (result.is_new_user) {
          setOnboardingUser(result.user)
          setStatus('onboarding')
        } else {
          onAuth(result.user)
        }
      } catch (err) {
        console.error('[OAuthCallback] api/auth/oauth-callback failed:', err)
        if (!cancelled) {
          setStatus('error')
          setError(getErrorMessage(err, t))
        }
      }
    }

    // detectSessionInUrl (see supabaseAuthClient.js) parses the OAuth
    // redirect asynchronously — onAuthStateChange catches it as soon as
    // that finishes, and the immediate getSession() call is a fallback for
    // the (rare) case the URL was already parsed before this listener
    // attached. The timeout below covers the case neither ever fires for
    // some other reason (the urlError check above already covers the known
    // "provider/Supabase sent back an error" case).
    const {
      data: { subscription },
    } = supabaseAuth.auth.onAuthStateChange((event, session) => {
      console.log('[OAuthCallback] onAuthStateChange fired:', event, session ? 'session present' : 'no session')
      if (session) finishSignIn(session)
    })

    supabaseAuth.auth.getSession().then(({ data, error: getSessionError }) => {
      if (getSessionError) console.error('[OAuthCallback] getSession() returned an error:', getSessionError)
      console.log('[OAuthCallback] getSession() fallback check:', data?.session ? 'session present' : 'no session')
      if (data?.session) finishSignIn(data.session)
    })

    const timeout = setTimeout(() => {
      if (!cancelled && !handledRef.current) {
        console.error('[OAuthCallback] timed out after 10s with no session and no URL error — giving up.')
        setStatus('error')
        setError(t('auth.oauth.timedOut'))
      }
    }, 10000)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
    // t is a stable function for the app's lifetime (see src/lib/i18n.js) —
    // not a real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAuth])

  if (status === 'merge' && mergeInfo) {
    return <OAuthMergeScreen mergeInfo={mergeInfo} onLinked={onAuth} onCancel={onCancel} />
  }

  if (status === 'onboarding' && onboardingUser) {
    return <OAuthOnboardingScreen user={onboardingUser} onDone={onAuth} />
  }

  if (status === 'error') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <Logo size="large" />
          <h2 className="oauth-onboarding-title">Sign-in failed</h2>
          <p className="form-error">{error}</p>
          <button type="button" className="btn btn-primary btn-block" onClick={onCancel}>
            Back to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Logo size="large" />
        <p className="auth-tagline">Signing you in…</p>
      </div>
    </div>
  )
}
