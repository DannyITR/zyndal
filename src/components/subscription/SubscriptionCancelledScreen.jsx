import { useTranslation } from 'react-i18next'
import Logo from '../shared/Logo'

// Rendered by App.jsx for the /subscription/cancelled path — the Checkout
// Session's cancel_url (see api/stripe/create-checkout.js). Purely static;
// no API call, since nothing happened server-side to confirm or apply.
export default function SubscriptionCancelledScreen({ onDone }) {
  const { t } = useTranslation()
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Logo size="large" />
        <p className="auth-tagline">{t('subscriptionCancelled.title')}</p>
        <button type="button" className="btn btn-primary btn-block" onClick={onDone}>
          {t('subscriptionCancelled.backCta')}
        </button>
      </div>
    </div>
  )
}
