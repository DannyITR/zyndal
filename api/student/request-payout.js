import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getStreakRow } from '../_lib/db.js'
import { getParentLinkForStudent, getParentWalletRow } from '../_lib/parentDb.js'
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
  const { coin_amount: coinAmount, note } = body

  const link = await getParentLinkForStudent(userId)
  if (!link) {
    const err = new Error('No linked parent account.')
    err.status = 403
    err.code = 'NO_LINKED_PARENT'
    throw err
  }

  // One request in flight at a time — matches WalletScreen.jsx's own
  // "⏳ Payout requested" disabled-button state, and stops a student from
  // stacking several requests against the same coin balance before the
  // parent resolves any of them.
  const { data: existingPending, error: pendingError } = await supabase
    .from('payout_requests')
    .select('id')
    .eq('student_id', userId)
    .eq('status', 'pending')
    .maybeSingle()
  if (pendingError) throw pendingError
  if (existingPending) {
    const err = new Error('You already have a payout request pending.')
    err.status = 400
    err.code = 'REQUEST_ALREADY_PENDING'
    throw err
  }

  const [streakRow, wallet] = await Promise.all([getStreakRow(userId), getParentWalletRow(link.parent_id)])
  if (coinAmount > streakRow.coin_balance) {
    const err = new Error('You cannot request more coins than you have.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  const dollarAmountCents = coinsToCents(coinAmount, wallet.coin_to_dollar_rate)
  if (dollarAmountCents > wallet.wallet_balance_cents) {
    const err = new Error("Your parent's wallet balance isn't enough to cover this payout yet.")
    err.status = 400
    err.code = 'INSUFFICIENT_PARENT_WALLET'
    throw err
  }

  const { data: requestRow, error: insertError } = await supabase
    .from('payout_requests')
    .insert({
      student_id: userId,
      parent_id: link.parent_id,
      coin_amount: coinAmount,
      dollar_amount_cents: dollarAmountCents,
      note,
    })
    .select()
    .single()
  if (insertError) throw insertError

  const [{ data: student }, { data: parent }] = await Promise.all([
    supabase.from('users').select('username').eq('id', userId).maybeSingle(),
    supabase.from('users').select('language_preference').eq('id', link.parent_id).maybeSingle(),
  ])
  const studentUsername = student?.username || 'Someone'
  const amount = centsToDisplay(dollarAmountCents)

  const { title, body: notifBody } = notificationText('payout_requested', parent?.language_preference, { studentUsername, amount })
  await insertNotification({
    userId: link.parent_id,
    type: 'payout_requested',
    title,
    body: notifBody,
    data: { request_id: requestRow.id, student_id: userId, student_username: studentUsername, coin_amount: coinAmount, dollar_amount_cents: dollarAmountCents },
  })
  await sendPushToUser({ userId: link.parent_id, type: 'payout_requested', title, body: notifBody, url: 'https://zyndal.ca' })

  return {
    id: requestRow.id,
    coinAmount: requestRow.coin_amount,
    dollarAmountCents: requestRow.dollar_amount_cents,
    note: requestRow.note,
    createdAt: requestRow.created_at,
  }
}

export default createStudentHandler({ method: 'POST', validate, handle })
