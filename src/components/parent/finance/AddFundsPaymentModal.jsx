import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const PRESETS_CENTS = [1000, 2000, 5000, 10000]

export default function AddFundsPaymentModal({ onClose, onFunded }) {
  const { t } = useTranslation()
  const [presetCents, setPresetCents] = useState(2000)
  const [customAmount, setCustomAmount] = useState('')
  const [method, setMethod] = useState('card')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [paidAmountCents, setPaidAmountCents] = useState(null)

  const effectiveAmountCents = customAmount ? Math.round(Number(customAmount) * 100) : presetCents
  const canSubmit = Number.isFinite(effectiveAmountCents) && effectiveAmountCents > 0

  async function handlePay(e) {
    e?.preventDefault()
    if (!canSubmit || processing) return
    setProcessing(true)
    setError('')
    try {
      // Simulated payment — no real processor is called. This is the only
      // spot that would need to become a real Stripe/PayPal charge later.
      await new Promise((resolve) => setTimeout(resolve, 700))
      await onFunded(effectiveAmountCents)
      setPaidAmountCents(effectiveAmountCents)
    } catch {
      setError(t('finance.paymentFailed'))
    } finally {
      setProcessing(false)
    }
  }

  if (paidAmountCents !== null) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="payment-success">
            <p className="payment-success-icon">✅</p>
            <h2 className="modal-title">{t('finance.paymentSuccessful')}</h2>
            <p className="modal-subtitle">{t('finance.addedToWallet', { amount: (paidAmountCents / 100).toFixed(2) })}</p>
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            {t('common.done')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card payment-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('finance.addFundsTitle')}</h2>
        <p className="modal-subtitle">{t('finance.simulatedPaymentNotice')}</p>

        <div className="preset-row">
          {PRESETS_CENTS.map((cents) => (
            <button
              key={cents}
              type="button"
              className={`preset-btn ${!customAmount && presetCents === cents ? 'preset-btn--active' : ''}`}
              onClick={() => {
                setPresetCents(cents)
                setCustomAmount('')
              }}
            >
              ${cents / 100}
            </button>
          ))}
        </div>

        <div className="field">
          <label htmlFor="funds-custom-amount">{t('finance.customAmount')}</label>
          <input
            id="funds-custom-amount"
            type="number"
            min="1"
            step="0.01"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="e.g. 35"
          />
        </div>

        <div className="payment-method-tabs">
          <button
            type="button"
            className={`payment-method-tab ${method === 'card' ? 'payment-method-tab--active' : ''}`}
            onClick={() => setMethod('card')}
          >
            {t('finance.cardTab')}
          </button>
          <button
            type="button"
            className={`payment-method-tab ${method === 'paypal' ? 'payment-method-tab--active' : ''}`}
            onClick={() => setMethod('paypal')}
          >
            {t('finance.paypalTab')}
          </button>
        </div>

        {method === 'card' ? (
          <form className="payment-form" onSubmit={handlePay}>
            <div className="field">
              <label htmlFor="card-number">{t('finance.cardNumber')}</label>
              <input
                id="card-number"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4242 4242 4242 4242"
                inputMode="numeric"
                autoComplete="cc-number"
              />
            </div>
            <div className="payment-form-row">
              <div className="field">
                <label htmlFor="card-expiry">{t('finance.expiry')}</label>
                <input
                  id="card-expiry"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="MM/YY"
                  autoComplete="cc-exp"
                />
              </div>
              <div className="field">
                <label htmlFor="card-cvv">{t('finance.cvv')}</label>
                <input
                  id="card-cvv"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  placeholder="123"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                />
              </div>
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit || processing}>
                {processing ? t('finance.processing') : t('finance.payAmount', { amount: (effectiveAmountCents / 100).toFixed(2) })}
              </button>
            </div>
          </form>
        ) : (
          <div className="payment-form">
            <p className="field-hint">{t('finance.paypalRedirectHint')}</p>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-paypal btn-block"
                disabled={!canSubmit || processing}
                onClick={handlePay}
              >
                {processing ? t('finance.processing') : t('finance.payWithPaypal')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
