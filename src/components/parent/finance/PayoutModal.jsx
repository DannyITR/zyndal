import { useState } from 'react'
import { coinsToCents, centsToDisplay } from '../../../lib/money'

export default function PayoutModal({ student, coins, rate, walletBalanceCents, onClose, onConfirm }) {
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
      setError("Couldn't process the payout. Please try again.")
      setConfirming(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Payout</h2>
        <p className="modal-subtitle">
          <strong>@{student.username}</strong> has <strong>{coins} coins</strong> = ${maxDollars} at your current
          rate of {rate} coins = $1.
        </p>

        <div className="field">
          <label htmlFor="payout-coins">Coins to pay out</label>
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
            Your wallet balance (${centsToDisplay(walletBalanceCents)}) isn't enough to cover this payout. Add funds
            first.
          </p>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={!canConfirm || confirming}
            onClick={handleConfirm}
          >
            {confirming ? 'Processing…' : `Confirm Payout ($${centsToDisplay(amountCents)})`}
          </button>
        </div>
      </div>
    </div>
  )
}
