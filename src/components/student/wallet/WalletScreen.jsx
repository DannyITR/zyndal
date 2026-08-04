import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getStudentWallet, requestPayout } from '../../../lib/storage'
import { centsToDisplay } from '../../../lib/money'
import TopBar from '../../shared/TopBar'

const PAYOUT_TYPE_KEYS = {
  manual: 'finance.payoutTypeManual',
  perfect_week_bonus: 'finance.payoutTypePerfectWeek',
  grade_bonus: 'finance.payoutTypeGradeBonus',
  request: 'finance.payoutTypeRequest',
}

export default function WalletScreen({ user, onBack, onNoLinkedParent, onLogout, onLogoClick }) {
  const { t } = useTranslation()
  const [wallet, setWallet] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [note, setNote] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [justRequested, setJustRequested] = useState(false)

  useEffect(() => {
    let cancelled = false
    getStudentWallet()
      .then((data) => {
        if (!cancelled) setWallet(data)
      })
      .catch((err) => {
        if (cancelled) return
        // Reachable if the parent link was severed after this page loaded
        // (e.g. another tab, or the parent deleting their account) — the
        // spec's "if somehow accessed without a parent link" case.
        if (err.code === 'NO_LINKED_PARENT') {
          onNoLinkedParent()
          return
        }
        setLoadError(t('wallet.loadFailed'))
      })
    return () => {
      cancelled = true
    }
    // onNoLinkedParent/t are stable for this screen's lifetime (a fresh
    // mount already happens on every StudentFlow show/hide toggle) — not
    // real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleConfirmRequest() {
    if (requesting || !wallet) return
    setRequesting(true)
    setRequestError('')
    try {
      const created = await requestPayout(wallet.coin_balance, note)
      setWallet((prev) => ({ ...prev, pending_request: created }))
      setShowConfirm(false)
      setNote('')
      setJustRequested(true)
    } catch (err) {
      setRequestError(err.message || t('wallet.requestFailed'))
    } finally {
      setRequesting(false)
    }
  }

  if (loadError) {
    return (
      <div className="screen student-screen">
        <TopBar title={t('wallet.title')} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />
        <p className="form-error">{loadError}</p>
      </div>
    )
  }

  if (!wallet) {
    return (
      <div className="screen student-screen">
        <TopBar title={t('wallet.title')} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />
        <p className="loading-text">{t('common.loading')}</p>
      </div>
    )
  }

  const dollarValue = centsToDisplay(wallet.dollar_value_cents)
  // "Funded wallet" — the spec's own gate for whether the button shows at
  // all, separate from whether the student currently has any coins to cash
  // out (that's the button's disabled state below, not its visibility).
  const parentWalletFunded = wallet.parent_wallet_balance_cents > 0

  return (
    <div className="screen student-screen">
      <TopBar title={t('wallet.title')} subtitle={t('wallet.subtitle')} username={user.username} onBack={onBack} onLogout={onLogout} onLogoClick={onLogoClick} />

      <div className="wallet-card">
        <p className="wallet-label">{t('wallet.currentBalance')}</p>
        <p className="wallet-balance">🪙 {wallet.coin_balance}</p>
        <p className="field-hint">{t('wallet.worthAtRate', { amount: dollarValue })}</p>
        <p className="field-hint">{t('wallet.conversionRate', { rate: wallet.coin_to_dollar_rate })}</p>

        {wallet.payout_cap_cents != null && (
          <p className="field-hint">
            {t(wallet.payout_cap_period === 'month' ? 'wallet.payoutCapMonth' : 'wallet.payoutCapWeek', {
              amount: centsToDisplay(wallet.payout_cap_cents),
            })}
          </p>
        )}

        {parentWalletFunded &&
          (wallet.pending_request ? (
            <button type="button" className="btn btn-secondary btn-block" disabled>
              {t('wallet.requestPending')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={wallet.coin_balance === 0}
              onClick={() => setShowConfirm(true)}
            >
              {t('wallet.requestPayoutButton')}
            </button>
          ))}

        {justRequested && <p className="form-success">{t('wallet.requestSuccess')}</p>}
      </div>

      <div className="finance-section-card">
        <h3 className="section-heading">{t('wallet.historyHeading')}</h3>
        {wallet.payout_history.length === 0 ? (
          <p className="field-hint">{t('wallet.noPayoutsYet')}</p>
        ) : (
          <ul className="payout-history-list">
            {wallet.payout_history.map((entry) => (
              <li key={entry.id} className="payout-history-row">
                <p className="payout-history-date">
                  {t('wallet.payoutHistoryDetail', {
                    type: t(PAYOUT_TYPE_KEYS[entry.type] || 'finance.payoutTypeManual'),
                    date: entry.date,
                  })}
                </p>
                <p className="payout-history-amount">${centsToDisplay(entry.amountCents)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showConfirm && (
        <div className="modal-overlay" onClick={() => !requesting && setShowConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{t('wallet.confirmTitle')}</h2>
            <p className="modal-subtitle">{t('wallet.confirmText', { coins: wallet.coin_balance, amount: dollarValue })}</p>

            <div className="field">
              <label htmlFor="payout-request-note">{t('wallet.noteLabel')}</label>
              <input
                id="payout-request-note"
                type="text"
                maxLength={100}
                placeholder={t('wallet.notePlaceholder')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {requestError && <p className="form-error">{requestError}</p>}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost btn-block" onClick={() => setShowConfirm(false)} disabled={requesting}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-primary btn-block" onClick={handleConfirmRequest} disabled={requesting}>
                {requesting ? t('finance.processing') : t('wallet.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
