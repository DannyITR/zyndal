import { useEffect, useState } from 'react'
import { verifyEmail } from '../../lib/storage'
import Logo from '../shared/Logo'

// zyndal.ca is now attached to the Vercel project (both the apex and
// www.zyndal.ca — see api/_lib/cors.js) and live, so this can link there
// directly rather than probing for reachability first.
const GO_TO_URL = 'https://zyndal.ca'

// Rendered by App.jsx for the /verify path — the second (after
// /auth/callback) URL this router-less app checks window.location for
// directly, since an email link has to survive a hard browser navigation.
// See vercel.json for the rewrite that serves index.html for this path.
export default function VerifyEmailScreen() {
  const [status, setStatus] = useState('verifying') // verifying | success | expired | invalid

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setStatus('invalid')
      return
    }

    let cancelled = false
    verifyEmail(token)
      .then(() => {
        if (!cancelled) setStatus('success')
      })
      .catch((err) => {
        if (cancelled) return
        setStatus(err.code === 'EXPIRED_TOKEN' ? 'expired' : 'invalid')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const content = {
    verifying: { icon: null, text: 'Verifying your email…' },
    success: { icon: '✅', text: 'Email verified! Your Zyndal account is ready.' },
    expired: { icon: '❌', text: 'This link has expired. Open Zyndal and request a new verification email.' },
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
        {status === 'success' && (
          <a href={GO_TO_URL} className="btn btn-primary btn-block">
            Go to Zyndal →
          </a>
        )}
      </div>
    </div>
  )
}
