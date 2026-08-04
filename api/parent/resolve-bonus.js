import { createParentHandler } from '../_lib/parentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getStreakRow } from '../_lib/db.js'
import { getParentWalletRow, walletRowToJson } from '../_lib/parentDb.js'
import { assertPremium } from '../_lib/subscription.js'
import { centsToCoins } from '../../src/lib/money.js'

// Mirrors resolvePerfectWeekAchievement and resolveGradeBonus in storage.js
// — same coins-in-exchange-for-wallet-dollars flow, just behind one shared
// endpoint. The two source tables (perfect_week_achievements, grade_bonuses)
// have independent id sequences, so bonus_type disambiguates which table
// bonus_id refers to — the literal spec's body shape doesn't include it, but
// bonus_id alone is ambiguous between the two tables. `confirmed: false`
// (not in the original two storage.js functions, which always paid) lets a
// parent dismiss a suggested bonus without paying it — a real gap the
// combined endpoint can now close cleanly.
const TABLES = {
  perfect_week: { name: 'perfect_week_achievements', payoutType: 'perfect_week_bonus' },
  grade_bonus: { name: 'grade_bonuses', payoutType: 'grade_bonus' },
}

function validate(body) {
  if (!body.bonus_id || typeof body.bonus_id !== 'string') return 'bonus_id is required.'
  if (!TABLES[body.bonus_type]) return "bonus_type must be 'perfect_week' or 'grade_bonus'."
  if (body.confirmed !== false && (!Number.isFinite(body.amount_cents) || body.amount_cents < 0)) {
    return 'amount_cents must be a non-negative number.'
  }
  return null
}

async function handle({ parentId, body }) {
  const { bonus_id: bonusId, bonus_type: bonusType, amount_cents: amountCents, confirmed } = body
  const table = TABLES[bonusType]

  const { data: bonusRow, error: fetchError } = await supabase
    .from(table.name)
    .select('*')
    .eq('id', bonusId)
    .eq('parent_id', parentId)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!bonusRow) {
    const err = new Error('Bonus not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  if (bonusRow.resolved) {
    const err = new Error('This bonus has already been resolved.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  const studentId = bonusRow.student_id
  // See payout.js's identical comment — checked against the student, not
  // the parent calling this endpoint.
  await assertPremium(studentId)

  if (confirmed === false) {
    const { error } = await supabase
      .from(table.name)
      .update({ resolved: true, resolved_amount_cents: 0, resolved_at: new Date().toISOString() })
      .eq('id', bonusId)
    if (error) throw error
    const streakRow = await getStreakRow(studentId)
    return {
      wallet: walletRowToJson(await getParentWalletRow(parentId)),
      studentCoinBalance: streakRow.coin_balance,
    }
  }

  const wallet = await getParentWalletRow(parentId)
  if (amountCents > wallet.wallet_balance_cents) {
    const err = new Error('Wallet balance is not enough to cover this bonus.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }
  const coinsToAdd = centsToCoins(amountCents, wallet.coin_to_dollar_rate)

  const streakRow = await getStreakRow(studentId)
  const { error: streakError } = await supabase
    .from('streaks')
    .update({ coin_balance: streakRow.coin_balance + coinsToAdd })
    .eq('user_id', studentId)
  if (streakError) throw streakError

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
    coins: coinsToAdd,
    amount_cents: amountCents,
    type: table.payoutType,
  })
  if (payoutError) throw payoutError

  const { error: resolveError } = await supabase
    .from(table.name)
    .update({ resolved: true, resolved_amount_cents: amountCents, resolved_at: new Date().toISOString() })
    .eq('id', bonusId)
  if (resolveError) throw resolveError

  return { wallet: walletRowToJson(updatedWalletRow), studentCoinBalance: streakRow.coin_balance + coinsToAdd }
}

export default createParentHandler({ method: 'POST', validate, handle })
