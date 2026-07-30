import { useEffect, useRef, useState } from 'react'
import { verifyEmail, resendExpiredVerification, getSessionToken, getCurrentUser } from '../../lib/storage'
import Logo from '../shared/Logo'

// zyndal.ca is attached to the Vercel project (both the apex and
// www.zyndal.ca — see api/_lib/cors.js) and live, so this can link there
// directly rather than probing for reachability first.
const GO_TO_URL = 'https://zyndal.ca'
const REDIRECT_DELAY_MS = 1500

// Rendered by App.jsx for the /verify path — the second (after
// /auth/callback) URL this router-less app checks window.location for
// directly, since an email link has to survive a hard browser navigation.
// See vercel.json for the rewrite that serves index.html for this path.
//
// onVerified (App.jsx's finishVerify) hands control back the same way
// OAuthCallbackScreen's onAuth does — called with the logged-in user to
// drop straight into the home screen, or left uncalled if the person needs
// to log in manually (expired/invalid link, or auto-login failing
// server-side — see api/auth/verify-email.js's comment on that).
export default function VerifyEmailScreen({ onVerified }) {
  // verifying | success | successManual | expired | invalid
  const [status, setStatus] = useState('verifying')
  const [resendState, setResendState] = useState('idle') // idle | sending | sent | error
  const [resendError, setResendError] = useState('')
  const tokenRef = useRef(null)

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    tokenRef.current = token
    if (!token) {
      setStatus('invalid')
      return
    }

    // Snapshot BEFORE calling verifyEmail — it overwrites the stored
    // session token if the backend returns one, so this is the only way
    // to later tell "was this device already logged in".
    const hadExistingSession = Boolean(getSessionToken())

    let cancelled = false
    let redirectTimer = null

    verifyEmail(token)
      .then(async (data) => {
        if (cancelled) return

        if (hadExistingSession) {
          // Already logged in on this device — just refresh and go, no
          // delay or message. data.user is already the full profile
          // (verifyEmail refetches it) whenever data.token was returned;
          // the getCurrentUser() fallback only matters if the backend's
          // bonus auto-login also failed even though this device already
          // had its own separate valid session.
          onVerified(data.user ?? (await getCurrentUser()))
          return
        }

        if (data.token && data.user) {
          setStatus('success')
          redirectTimer = setTimeout(() => {
            if (!cancelled) onVerified(data.user)
          }, REDIRECT_DELAY_MS)
        } else {
          setStatus('successManual')
        }
      })
      .catch((err) => {
        if (cancelled) return
        setStatus(err.code === 'EXPIRED_TOKEN' ? 'expired' : 'invalid')
      })

    return () => {
      cancelled = true
      if (redirectTimer) clearTimeout(redirectTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleResend() {
    if (resendState === 'sending' || !tokenRef.current) return
    setResendState('sending')
    setResendError('')
    try {
      await resendExpiredVerification(tokenRef.current)
      setResendState('sent')
    } catch (err) {
      setResendState('error')
      setResendError(err.message || "Couldn't send the email. Please try again.")
    }
  }

  const content = {
    verifying: { icon: null, text: 'Verifying your email…' },
    success: { icon: '✅', text: 'Email verified! Logging you in…' },
    successManual: { icon: '✅', text: 'Email verified! Your Zyndal account is ready.' },
    expired: { icon: '❌', text: 'This link has expired.' },
    invalid: { icon: '❌', text: 'Invalid verification link.' },
  }[status]

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Logo size="large" />
        <p className="auth-tagline">
          {content.icon && <span>{content.icon} </span>}
          {content.text}
        </p>

        {status === 'successManual' && (
          <a href={GO_TO_URL} className="btn btn-primary btn-block">
            Log In →
          </a>
        )}

        {status === 'expired' && (
          <>
            {resendState === 'sent' ? (
              <p className="auth-tagline">Sent! Check your inbox for a new link.</p>
            ) : (
              <button type="button" className="btn btn-primary btn-block" onClick={handleResend} disabled={resendState === 'sending'}>
                {resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
              </button>
            )}
            {resendState === 'error' && <p className="form-error">{resendError}</p>}
          </>
        )}

        {status === 'invalid' && (
          <a href={GO_TO_URL} className="btn btn-primary btn-block">
            Log In →
          </a>
        )}
      </div>
    </div>
  )
}
