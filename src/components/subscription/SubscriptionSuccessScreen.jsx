import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { verifySubscriptionSession } from '../../lib/storage'
import Logo from '../shared/Logo'

// Rendered by App.jsx for the /subscription/success path — the Checkout
// Session's success_url (see api/stripe/create-checkout.js), reached after
// a real hard navigation away to Stripe and back, same rationale as
// VerifyEmailScreen/OAuthCallbackScreen checking window.location directly.
// See vercel.json for the rewrite that serves index.html for this path.
//
// verifySubscriptionSession (api/stripe/verify-session.js) both confirms
// payment AND applies the grant (idempotent — races safely against
// api/stripe/webhook.js, whichever fires first wins), so by the time
// status is 'success' the returned user object already reflects Premium.
// onDone is only called when the user taps the continue button (not
// auto-redirected) — App.jsx's finishSubscriptionSuccess updates the app's
// user state and clears the URL at that point.
export default function SubscriptionSuccessScreen({ onDone }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState('verifying') // verifying | success | error
  const [result, setResult] = useState(null)

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id')
    if (!sessionId) {
      setStatus('error')
      return
    }
    let cancelled = false
    verifySubscriptionSession(sessionId)
      .then((data) => {
        if (cancelled) return
        if (!data.paid) {
          setStatus('error')
          return
        }
        setResult(data)
        setStatus('success')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Logo size="large" />

        {status === 'verifying' && <p className="auth-tagline">{t('subscriptionSuccess.verifying')}</p>}

        {status === 'success' && (
          <>
            <p className="auth-tagline">
              🎉 {result?.cascaded ? t('subscriptionSuccess.titleFamily') : t('subscriptionSuccess.title')}
            </p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => onDone(result?.user)}>
              {t('subscriptionSuccess.continueCta')}
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <p className="auth-tagline">{t('subscriptionSuccess.error')}</p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => onDone(null)}>
              {t('subscriptionSuccess.continueCta')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
