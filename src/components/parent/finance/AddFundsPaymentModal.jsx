import { useState } from 'react'

const PRESETS_CENTS = [1000, 2000, 5000, 10000]

export default function AddFundsPaymentModal({ onClose, onFunded }) {
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
      setError("Payment couldn't be processed. Please try again.")
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
            <h2 className="modal-title">Payment Successful</h2>
            <p className="modal-subtitle">${(paidAmountCents / 100).toFixed(2)} added to your wallet.</p>
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card payment-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Add Funds</h2>
        <p className="modal-subtitle">Simulated payment — no real charge will be made.</p>

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
          <label htmlFor="funds-custom-amount">Custom amount ($)</label>
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
            💳 Card
          </button>
          <button
            type="button"
            className={`payment-method-tab ${method === 'paypal' ? 'payment-method-tab--active' : ''}`}
            onClick={() => setMethod('paypal')}
          >
            🅿️ PayPal
          </button>
        </div>

        {method === 'card' ? (
          <form className="payment-form" onSubmit={handlePay}>
            <div className="field">
              <label htmlFor="card-number">Card number</label>
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
                <label htmlFor="card-expiry">Expiry</label>
                <input
                  id="card-expiry"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="MM/YY"
                  autoComplete="cc-exp"
                />
              </div>
              <div className="field">
                <label htmlFor="card-cvv">CVV</label>
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
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit || processing}>
                {processing ? 'Processing…' : `Pay $${(effectiveAmountCents / 100).toFixed(2)}`}
              </button>
            </div>
          </form>
        ) : (
          <div className="payment-form">
            <p className="field-hint">You'll be redirected to PayPal to complete this simulated payment.</p>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-paypal btn-block"
                disabled={!canSubmit || processing}
                onClick={handlePay}
              >
                {processing ? 'Processing…' : 'Pay with PayPal'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
