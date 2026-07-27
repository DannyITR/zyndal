import { createParentHandler } from '../_lib/parentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getStreakRow } from '../_lib/db.js'
import { verifyStudentBelongsToParent, getParentWalletRow, walletRowToJson } from '../_lib/parentDb.js'
import { sanitizeUuid, sanitizeInteger } from '../_lib/sanitize.js'

// Mirrors payoutStudentCoins in storage.js: cashes out a student's coins for
// real dollars, deducting coins from the student and cents from the parent's
// wallet. The literal spec for this endpoint only lists { student_id,
// amount_cents, payout_type } — but "how many coins" can't be safely
// re-derived from amount_cents alone (coinsToCents/centsToCoins round, so
// recomputing coins from cents here could drift from the coin count the
// parent actually saw and confirmed in the UI). `coins` is accepted
// alongside amount_cents for that reason, matching payoutStudentCoins'
// existing (parentId, studentId, coins, amountCents) signature.
function validate(body) {
  const studentId = sanitizeUuid(body.student_id)
  if (!studentId) return { field: 'student_id', message: 'student_id must be a valid UUID.' }
  body.student_id = studentId

  if (!Number.isFinite(body.coins) || body.coins <= 0) {
    return { field: 'coins', message: 'coins must be a positive number.' }
  }

  const amountCents = sanitizeInteger(body.amount_cents, 1, 1000000)
  if (amountCents === null) {
    return { field: 'amount_cents', message: 'amount_cents must be a whole number between 1 and 1000000.' }
  }
  body.amount_cents = amountCents

  return null
}

async function handle({ parentId, body }) {
  const { student_id: studentId, coins, amount_cents: amountCents, payout_type: payoutType } = body
  await verifyStudentBelongsToParent(parentId, studentId)

  const streakRow = await getStreakRow(studentId)
  if (coins > streakRow.coin_balance) {
    const err = new Error('Cannot pay out more coins than the student has.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  const { error: streakError } = await supabase
    .from('streaks')
    .update({ coin_balance: streakRow.coin_balance - coins })
    .eq('user_id', studentId)
  if (streakError) throw streakError

  const wallet = await getParentWalletRow(parentId)
  const { data: updatedWalletRow, error: walletError } = await supabase
    .from('users')
    .update({
      wallet_balance_cents: wallet.wallet_balance_cents - amountCents,
      total_paid_out_cents: wallet.total_paid_out_cents + amountCents,
    })
    .eq('id', parentId)
    .select('wallet_balance_cents, total_added_cents, total_paid_out_cents, coin_to_dollar_rate, milestone_settings')
    .single()
  if (walletError) throw walletError

  const { error: payoutError } = await supabase.from('payouts').insert({
    parent_id: parentId,
    student_id: studentId,
    coins,
    amount_cents: amountCents,
    type: payoutType || 'manual',
  })
  if (payoutError) throw payoutError

  return { wallet: walletRowToJson(updatedWalletRow), studentCoinBalance: streakRow.coin_balance - coins }
}

export default createParentHandler({ method: 'POST', validate, handle })
