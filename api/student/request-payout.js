import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getStreakRow } from '../_lib/db.js'
import { getParentLinksForStudent, getParentWalletRow } from '../_lib/parentDb.js'
import { assertPremium } from '../_lib/subscription.js'
import { insertNotification } from '../_lib/notifications.js'
import { notificationText } from '../_lib/notificationText.js'
import { sendPushToUser } from '../_lib/push.js'
import { sanitizeInteger, sanitizeString } from '../_lib/sanitize.js'
import { coinsToCents, centsToDisplay } from '../../src/lib/money.js'

function validate(body) {
  const coinAmount = sanitizeInteger(body.coin_amount, 1, 1000000)
  if (coinAmount === null) return { field: 'coin_amount', message: 'coin_amount must be a whole number greater than 0.' }
  body.coin_amount = coinAmount

  // '' (not provided) is stored as null, not an empty string — matches
  // every other optional-text-field convention in this codebase (e.g.
  // notes/comments elsewhere never distinguish "" from unset).
  body.note = body.note ? sanitizeString(body.note, 100) || null : null

  return null
}

async function handle({ userId, body }) {
  await assertPremium(userId)
  const { coin_amount: coinAmount, note } = body

  const links = await getParentLinksForStudent(userId)
  if (links.length === 0) {
    const err = new Error('No linked parent account.')
    err.status = 403
    err.code = 'NO_LINKED_PARENT'
    throw err
  }

  // One request in flight at a time — matches WalletScreen.jsx's own
  // "⏳ Payout requested" disabled-button state, and stops a student from
  // stacking several requests against the same coin balance before a
  // parent resolves any of them. Still keyed on student_id alone —
  // correct regardless of how many parents are linked, since it's the
  // student's coin balance (not any one parent's wallet) that's scarce.
  const { data: existingPending, error: pendingError } = await supabase
    .from('payout_requests')
    .select('id')
    .eq('student_id', userId)
    .eq('status', 'pending')
    .limit(1)
  if (pendingError) throw pendingError
  if (existingPending && existingPending.length > 0) {
    const err = new Error('You already have a payout request pending.')
    err.status = 400
    err.code = 'REQUEST_ALREADY_PENDING'
    throw err
  }

  const [streakRow, wallets] = await Promise.all([getStreakRow(userId), Promise.all(links.map((l) => getParentWalletRow(l.parent_id)))])
  if (coinAmount > streakRow.coin_balance) {
    const err = new Error('You cannot request more coins than you have.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  // Each linked parent has their own coin_to_dollar_rate, so the dollar
  // amount they'd each pay can differ — computed per parent below. The
  // upfront affordability check only rejects if NEITHER linked parent
  // could currently cover it; resolve-payout-request.js re-validates
  // against CURRENT balances at approval time regardless (balances can
  // move between request and approval either way), so rejecting here on
  // the stricter of two wallets would block a request the other parent
  // could actually approve.
  const perParentAmounts = links.map((link, i) => ({
    link,
    dollarAmountCents: coinsToCents(coinAmount, wallets[i].coin_to_dollar_rate),
    walletBalanceCents: wallets[i].wallet_balance_cents,
  }))
  const anyParentCanAfford = perParentAmounts.some((p) => p.dollarAmountCents <= p.walletBalanceCents)
  if (!anyParentCanAfford) {
    const err = new Error("Your parents' wallet balances aren't enough to cover this payout yet.")
    err.status = 400
    err.code = 'INSUFFICIENT_PARENT_WALLET'
    throw err
  }

  const { data: student } = await supabase.from('users').select('username').eq('id', userId).maybeSingle()
  const studentUsername = student?.username || 'Someone'
  const requestGroupId = crypto.randomUUID()

  const { data: requestRows, error: insertError } = await supabase
    .from('payout_requests')
    .insert(
      perParentAmounts.map(({ link, dollarAmountCents }) => ({
        student_id: userId,
        parent_id: link.parent_id,
        coin_amount: coinAmount,
        dollar_amount_cents: dollarAmountCents,
        note,
        request_group_id: requestGroupId,
      }))
    )
    .select()
  if (insertError) throw insertError

  const parentIds = perParentAmounts.map((p) => p.link.parent_id)
  const { data: parentRows } = await supabase.from('users').select('id, language_preference').in('id', parentIds)
  const parentById = Object.fromEntries((parentRows || []).map((p) => [p.id, p]))

  for (const requestRow of requestRows) {
    const amount = centsToDisplay(requestRow.dollar_amount_cents)
    const { title, body: notifBody } = notificationText('payout_requested', parentById[requestRow.parent_id]?.language_preference, {
      studentUsername,
      amount,
    })
    await insertNotification({
      userId: requestRow.parent_id,
      type: 'payout_requested',
      title,
      body: notifBody,
      data: { request_id: requestRow.id, student_id: userId, student_username: studentUsername, coin_amount: coinAmount, dollar_amount_cents: requestRow.dollar_amount_cents },
    })
    await sendPushToUser({ userId: requestRow.parent_id, type: 'payout_requested', title, body: notifBody, url: 'https://zyndal.ca' })
  }

  // The dollar amount depends on which parent ends up approving, which
  // isn't decided yet — the student only ever needs the coin amount and
  // "it's pending" status (see WalletScreen.jsx's copy).
  return {
    coinAmount,
    note,
    createdAt: requestRows[0]?.created_at,
  }
}

export default createStudentHandler({ method: 'POST', validate, handle })
