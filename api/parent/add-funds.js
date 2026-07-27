import { createParentHandler } from '../_lib/parentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getParentWalletRow, walletRowToJson } from '../_lib/parentDb.js'
import { sanitizeInteger } from '../_lib/sanitize.js'

// Mirrors addFundsToWallet in storage.js. Simulated money only — no real
// payment processor is involved (see the "Parent finances" header comment
// in storage.js) — so this just increments the two wallet columns.
// 100-1000000 cents ($1-$10,000) bounds a single funding transaction to a
// sane range — the preset buttons in AddFundsPaymentModal.jsx (10/20/50/100
// dollars) are well inside it; only a hand-crafted request would ever hit
// either edge.
function validate(body) {
  const amountCents = sanitizeInteger(body.amount_cents, 100, 1000000)
  if (amountCents === null) {
    return { field: 'amount_cents', message: 'amount_cents must be a whole number between 100 ($1) and 1000000 ($10,000).' }
  }
  body.amount_cents = amountCents
  return null
}

async function handle({ parentId, body }) {
  const wallet = await getParentWalletRow(parentId)
  const { data, error } = await supabase
    .from('users')
    .update({
      wallet_balance_cents: wallet.wallet_balance_cents + body.amount_cents,
      total_added_cents: wallet.total_added_cents + body.amount_cents,
    })
    .eq('id', parentId)
    .select('wallet_balance_cents, total_added_cents, total_paid_out_cents, coin_to_dollar_rate, milestone_settings')
    .single()
  if (error) throw error
  return walletRowToJson(data)
}

export default createParentHandler({ method: 'POST', validate, handle })
