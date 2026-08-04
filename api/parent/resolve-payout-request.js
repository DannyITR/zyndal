import { createParentHandler } from '../_lib/parentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getStreakRow } from '../_lib/db.js'
import { getParentWalletRow, applyPayout, walletRowToJson } from '../_lib/parentDb.js'
import { assertPremium } from '../_lib/subscription.js'
import { insertNotification } from '../_lib/notifications.js'
import { notificationText } from '../_lib/notificationText.js'
import { sendPushToUser } from '../_lib/push.js'
import { sanitizeUuid } from '../_lib/sanitize.js'
import { centsToDisplay } from '../../src/lib/money.js'

function validate(body) {
  const requestId = sanitizeUuid(body.request_id)
  if (!requestId) return { field: 'request_id', message: 'request_id must be a valid UUID.' }
  body.request_id = requestId

  if (body.action !== 'approve' && body.action !== 'decline') {
    return { field: 'action', message: "action must be 'approve' or 'decline'." }
  }
  return null
}

async function handle({ parentId, body }) {
  const { request_id: requestId, action } = body

  // .eq('parent_id', parentId) is the authorization check — a request row
  // that exists but belongs to a different parent reads as "not found"
  // rather than leaking whether the id is real, matching
  // verifyStudentBelongsToParent's convention elsewhere in this file's
  // sibling endpoints.
  const { data: requestRow, error: fetchError } = await supabase
    .from('payout_requests')
    .select('*')
    .eq('id', requestId)
    .eq('parent_id', parentId)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!requestRow) {
    const err = new Error('Payout request not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (requestRow.status !== 'pending') {
    const err = new Error('This payout request has already been resolved.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  const studentId = requestRow.student_id
  // See payout.js's identical comment — checked against the student, not
  // the parent calling this endpoint.
  await assertPremium(studentId)
  const { data: student } = await supabase.from('users').select('language_preference').eq('id', studentId).maybeSingle()

  if (action === 'decline') {
    const { error: updateError } = await supabase
      .from('payout_requests')
      .update({ status: 'declined', resolved_at: new Date().toISOString() })
      .eq('id', requestId)
    if (updateError) throw updateError

    const { title, body: notifBody } = notificationText('payout_declined', student?.language_preference)
    await insertNotification({ userId: studentId, type: 'payout_declined', title, body: notifBody, data: { request_id: requestId } })
    await sendPushToUser({ userId: studentId, type: 'payout_declined', title, body: notifBody, url: 'https://zyndal.ca' })

    const [wallet, streakRow] = await Promise.all([getParentWalletRow(parentId), getStreakRow(studentId)])
    return { wallet: walletRowToJson(wallet), studentCoinBalance: streakRow.coin_balance }
  }

  // Re-validated against CURRENT balances, not just trusted from when the
  // request was made — the parent's wallet or the student's coin balance
  // may have moved since (another payout, more correct answers, etc).
  const wallet = await getParentWalletRow(parentId)
  if (requestRow.dollar_amount_cents > wallet.wallet_balance_cents) {
    const err = new Error('Your wallet balance is not enough to cover this payout.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  const { updatedWalletRow, newCoinBalance } = await applyPayout({
    parentId,
    studentId,
    coins: requestRow.coin_amount,
    amountCents: requestRow.dollar_amount_cents,
    type: 'request',
  })

  const { error: updateError } = await supabase
    .from('payout_requests')
    .update({ status: 'approved', resolved_at: new Date().toISOString() })
    .eq('id', requestId)
  if (updateError) throw updateError

  const amount = centsToDisplay(requestRow.dollar_amount_cents)
  const { title, body: notifBody } = notificationText('payout_approved', student?.language_preference, { amount })
  await insertNotification({ userId: studentId, type: 'payout_approved', title, body: notifBody, data: { request_id: requestId, amount_cents: requestRow.dollar_amount_cents } })
  await sendPushToUser({ userId: studentId, type: 'payout_approved', title, body: notifBody, url: 'https://zyndal.ca' })

  return { wallet: walletRowToJson(updatedWalletRow), studentCoinBalance: newCoinBalance }
}

export default createParentHandler({ method: 'POST', validate, handle })
