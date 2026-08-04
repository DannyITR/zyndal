import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getStreakRow } from '../_lib/db.js'
import { getParentLinkForStudent, getParentWalletRow, getPayoutHistoryForStudent } from '../_lib/parentDb.js'
import { coinsToCents } from '../../src/lib/money.js'

// Backs the student Wallet page — one aggregate read the same way
// get-dashboard.js is the parent side's, since the page needs the link
// itself (to know a parent exists at all), the parent's rate/balance, the
// student's own coin balance, any pending request, and payout history all
// at once. No linked parent -> NO_LINKED_PARENT, which WalletScreen.jsx
// treats as "redirect back to home screen" (a student could reach this
// endpoint directly, e.g. a stale bookmark/back-button state, only if they
// were unlinked after the page loaded).
async function handle({ userId }) {
  const link = await getParentLinkForStudent(userId)
  if (!link) {
    const err = new Error('No linked parent account.')
    err.status = 403
    err.code = 'NO_LINKED_PARENT'
    throw err
  }

  const [wallet, streakRow, pendingRequest, payoutHistory] = await Promise.all([
    getParentWalletRow(link.parent_id),
    getStreakRow(userId),
    supabase
      .from('payout_requests')
      .select('id, coin_amount, dollar_amount_cents, note, created_at')
      .eq('student_id', userId)
      .eq('status', 'pending')
      .maybeSingle()
      .then((r) => {
        if (r.error) throw r.error
        return r.data
      }),
    getPayoutHistoryForStudent(userId),
  ])

  return {
    coin_balance: streakRow.coin_balance,
    coin_to_dollar_rate: wallet.coin_to_dollar_rate,
    dollar_value_cents: coinsToCents(streakRow.coin_balance, wallet.coin_to_dollar_rate),
    parent_wallet_balance_cents: wallet.wallet_balance_cents,
    payout_cap_cents: link.payout_cap_cents,
    payout_cap_period: link.payout_cap_period,
    pending_request: pendingRequest
      ? {
          id: pendingRequest.id,
          coinAmount: pendingRequest.coin_amount,
          dollarAmountCents: pendingRequest.dollar_amount_cents,
          note: pendingRequest.note,
          createdAt: pendingRequest.created_at,
        }
      : null,
    payout_history: payoutHistory,
  }
}

export default createStudentHandler({ method: 'GET', handle })
