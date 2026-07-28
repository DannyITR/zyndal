import { useEffect, useRef, useState } from 'react'
import { supabaseAuth } from '../../lib/supabaseAuthClient'
import { oauthCallback } from '../../lib/storage'
import Logo from '../shared/Logo'
import OAuthMergeScreen from './OAuthMergeScreen'
import OAuthOnboardingScreen from './OAuthOnboardingScreen'

// Rendered by App.jsx for the /auth/callback path (see the
// window.location.pathname check there — this app has no client-side
// router, so that's the closest thing to a "route" it has). Google/Facebook
// redirect the whole browser back here after the person approves sign-in;
// this screen's only job is turning that into a Zyndal login by calling
// api/auth/oauth-callback.js, then handing off to whichever of the three
// outcomes applies.
export default function OAuthCallbackScreen({ onAuth, onCancel }) {
  const [status, setStatus] = useState('loading') // loading | merge | onboarding | error
  const [mergeInfo, setMergeInfo] = useState(null)
  const [onboardingUser, setOnboardingUser] = useState(null)
  const [error, setError] = useState('')
  const handledRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function finishSignIn(session) {
      if (handledRef.current) return
      handledRef.current = true

      const provider = session.user?.app_metadata?.provider || session.user?.identities?.[0]?.provider
      if (provider !== 'google' && provider !== 'facebook') {
        if (!cancelled) {
          setStatus('error')
          setError('Unsupported sign-in provider.')
        }
        return
      }

      try {
        const result = await oauthCallback({ provider, supabaseAccessToken: session.access_token })
        if (cancelled) return

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
        if (!cancelled) {
          setStatus('error')
          setError(err.message || "Couldn't finish signing in. Please try again.")
        }
      }
    }

    // detectSessionInUrl (see supabaseAuthClient.js) parses the OAuth
    // redirect asynchronously — onAuthStateChange catches it as soon as
    // that finishes, and the immediate getSession() call is a fallback for
    // the (rare) case the URL was already parsed before this listener
    // attached. A timeout below covers the case neither ever fires (e.g.
    // the provider redirected back with an error in the URL instead of a
    // session).
    const {
      data: { subscription },
    } = supabaseAuth.auth.onAuthStateChange((_event, session) => {
      if (session) finishSignIn(session)
    })

    supabaseAuth.auth.getSession().then(({ data }) => {
      if (data?.session) finishSignIn(data.session)
    })

    const timeout = setTimeout(() => {
      if (!cancelled && !handledRef.current) {
        setStatus('error')
        setError('Sign-in did not complete. Please try again.')
      }
    }, 10000)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
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
