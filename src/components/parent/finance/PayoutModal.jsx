import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { coinsToCents, centsToDisplay } from '../../../lib/money'

export default function PayoutModal({ student, coins, rate, walletBalanceCents, onClose, onConfirm }) {
  const { t } = useTranslation()
  const maxDollars = centsToDisplay(coinsToCents(coins, rate))
  const [coinsToPay, setCoinsToPay] = useState(String(coins))
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  const numericCoins = Number(coinsToPay)
  const amountCents = Number.isFinite(numericCoins) ? coinsToCents(numericCoins, rate) : 0
  const insufficientWallet = amountCents > walletBalanceCents
  const canConfirm = Number.isInteger(numericCoins) && numericCoins > 0 && numericCoins <= coins && !insufficientWallet

  async function handleConfirm() {
    if (!canConfirm || confirming) return
    setConfirming(true)
    setError('')
    try {
      await onConfirm(numericCoins)
    } catch {
      setError(t('finance.payoutFailed'))
      setConfirming(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('finance.payout')}</h2>
        <p className="modal-subtitle">
          {t('finance.payoutSubtitle', { username: student.username, coins, dollars: maxDollars, rate })}
        </p>

        <div className="field">
          <label htmlFor="payout-coins">{t('finance.coinsToPayOut')}</label>
          <input
            id="payout-coins"
            type="number"
            min="1"
            max={coins}
            value={coinsToPay}
            onChange={(e) => setCoinsToPay(e.target.value)}
          />
          <p className="field-hint">= ${centsToDisplay(amountCents)}</p>
        </div>

        {insufficientWallet && (
          <p className="form-error">
            {t('finance.insufficientWallet', { balance: centsToDisplay(walletBalanceCents) })}
          </p>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={!canConfirm || confirming}
            onClick={handleConfirm}
          >
            {confirming ? t('finance.processing') : t('finance.confirmPayout', { amount: centsToDisplay(amountCents) })}
          </button>
        </div>
      </div>
    </div>
  )
}
