import { useEffect, useState } from 'react'
import { verifyEmail } from '../../lib/storage'
import Logo from '../shared/Logo'

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
    success: { icon: '✅', text: 'Email verified! You can now close this tab.' },
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
      </div>
    </div>
  )
}
