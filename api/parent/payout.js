import { createParentHandler } from '../_lib/parentHandler.js'
import { verifyStudentBelongsToParent, applyPayout, walletRowToJson } from '../_lib/parentDb.js'
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

  const { updatedWalletRow, newCoinBalance } = await applyPayout({
    parentId,
    studentId,
    coins,
    amountCents,
    type: payoutType || 'manual',
  })

  return { wallet: walletRowToJson(updatedWalletRow), studentCoinBalance: newCoinBalance }
}

export default createParentHandler({ method: 'POST', validate, handle })
