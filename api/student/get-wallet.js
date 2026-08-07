import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getStreakRow } from '../_lib/db.js'
import { getParentLinksForStudent, getParentWalletRow, getPayoutHistoryForStudent } from '../_lib/parentDb.js'
import { coinsToCents } from '../../src/lib/money.js'

// Backs the student Wallet page — one aggregate read the same way
// get-dashboard.js is the parent side's, since the page needs the link(s)
// themselves (to know a parent exists at all), each linked parent's
// rate/balance, the student's own coin balance, any pending request, and
// payout history all at once. No linked parent -> NO_LINKED_PARENT, which
// WalletScreen.jsx treats as "redirect back to home screen" (a student
// could reach this endpoint directly, e.g. a stale bookmark/back-button
// state, only if they were unlinked after the page loaded).
//
// With up to 2 linked parents possibly having different rates/caps, the
// single headline number this page shows picks: the LOWER
// coin_to_dollar_rate (coin_to_dollar_rate is "coins per dollar" — see
// money.js — so a LOWER number means each coin is worth MORE, the more
// favorable direction for the student; approval-time re-validation in
// resolve-payout-request.js is the real backstop either way, since the
// actual amount paid always uses whichever specific parent approves'
// own rate, not this display estimate) and the STRICTER (lower) payout
// cap when more than one parent has actually set one (a cap is a
// deliberate limit — silently using the looser one would defeat a
// parent's intent).
async function handle({ userId }) {
  const links = await getParentLinksForStudent(userId)
  if (links.length === 0) {
    const err = new Error('No linked parent account.')
    err.status = 403
    err.code = 'NO_LINKED_PARENT'
    throw err
  }

  const [wallets, streakRow, pendingRequests, payoutHistory] = await Promise.all([
    Promise.all(links.map((link) => getParentWalletRow(link.parent_id))),
    getStreakRow(userId),
    supabase
      .from('payout_requests')
      .select('id, coin_amount, dollar_amount_cents, note, created_at')
      .eq('student_id', userId)
      .eq('status', 'pending')
      .limit(1)
      .then((r) => {
        if (r.error) throw r.error
        return r.data
      }),
    getPayoutHistoryForStudent(userId),
  ])
  const pendingRequest = pendingRequests?.[0] || null

  const bestRate = Math.min(...wallets.map((w) => w.coin_to_dollar_rate))
  const maxParentWalletBalanceCents = Math.max(...wallets.map((w) => w.wallet_balance_cents))
  const linksWithCaps = links.filter((l) => l.payout_cap_cents != null)
  const stricterCapLink =
    linksWithCaps.length > 0 ? linksWithCaps.reduce((min, l) => (l.payout_cap_cents < min.payout_cap_cents ? l : min)) : null

  return {
    coin_balance: streakRow.coin_balance,
    coin_to_dollar_rate: bestRate,
    dollar_value_cents: coinsToCents(streakRow.coin_balance, bestRate),
    parent_wallet_balance_cents: maxParentWalletBalanceCents,
    payout_cap_cents: stricterCapLink?.payout_cap_cents ?? null,
    payout_cap_period: stricterCapLink?.payout_cap_period ?? null,
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
