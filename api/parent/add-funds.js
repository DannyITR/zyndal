import { createParentHandler } from '../_lib/parentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getParentWalletRow, walletRowToJson } from '../_lib/parentDb.js'

// Mirrors addFundsToWallet in storage.js. Simulated money only — no real
// payment processor is involved (see the "Parent finances" header comment
// in storage.js) — so this just increments the two wallet columns.
function validate(body) {
  if (!Number.isFinite(body.amount_cents) || body.amount_cents <= 0) return 'amount_cents must be a positive number.'
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
