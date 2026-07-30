import { useEffect, useState } from 'react'
import { verifyEmail } from '../../lib/storage'
import Logo from '../shared/Logo'

// zyndal.ca isn't attached as a Vercel domain yet (as of this writing —
// see `vercel domains ls`), just verified as a Resend sending domain, so
// it may not resolve. Probed on success below; falls back to the
// guaranteed-working .vercel.app URL if zyndal.ca doesn't answer in time.
const PRIMARY_URL = 'https://zyndal.ca'
const FALLBACK_URL = 'https://zyndal.vercel.app'
const PROBE_TIMEOUT_MS = 2500

// Rendered by App.jsx for the /verify path — the second (after
// /auth/callback) URL this router-less app checks window.location for
// directly, since an email link has to survive a hard browser navigation.
// See vercel.json for the rewrite that serves index.html for this path.
export default function VerifyEmailScreen() {
  const [status, setStatus] = useState('verifying') // verifying | success | expired | invalid
  const [goToUrl, setGoToUrl] = useState(FALLBACK_URL)

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

  // mode: 'no-cors' resolves for anything that answers (even an opaque
  // cross-origin response) and rejects on a real network/DNS failure —
  // exactly the "does this domain currently resolve" check needed here,
  // without caring what it actually returns.
  useEffect(() => {
    if (status !== 'success') return
    let cancelled = false
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    fetch(PRIMARY_URL, { mode: 'no-cors', signal: controller.signal })
      .then(() => {
        if (!cancelled) setGoToUrl(PRIMARY_URL)
      })
      .catch(() => {
        // zyndal.ca not reachable yet — stick with the fallback already set.
      })
      .finally(() => clearTimeout(timeout))
    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timeout)
    }
  }, [status])

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
          <a href={goToUrl} className="btn btn-primary btn-block">
            Go to Zyndal →
          </a>
        )}
      </div>
    </div>
  )
}
