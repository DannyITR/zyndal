// Shared parent-domain helpers used across api/parent/*.js — mirrors the
// parent-related private/exported helpers in src/lib/storage.js the same
// way db.js mirrors the student ones (see db.js's header comment for why
// storage.js itself can't be imported directly here).
import { supabase } from './auth.js'
import { getStreakRow } from './db.js'

// Excludes password (see get-profile.js/update-settings.js from Session 3)
// and the wallet/financial columns, which only ever make sense for the
// PARENT's own row (getParentWalletRow below), not a student's.
const STUDENT_SAFE_COLUMNS =
  'id, username, account_type, grade, parent_code, created_at, display_name, email, school, avatar, is_premium, language_preference'

export async function getParentLinks(parentId) {
  const { data, error } = await supabase
    .from('parent_student')
    .select(
      'student_id, perfect_week_bonus, grade_reward_a_plus_cents, grade_reward_a_cents, grade_reward_b_cents, grade_reward_c_cents'
    )
    .eq('parent_id', parentId)
  if (error) throw error
  return data || []
}

export async function getStudentRows(studentIds) {
  if (studentIds.length === 0) return []
  const { data, error } = await supabase.from('users').select(STUDENT_SAFE_COLUMNS).in('id', studentIds)
  if (error) throw error
  return data || []
}

// Shared by every parent-student linking entry point (link-parent.js,
// link-request.js, respond-parent-link.js, search-students.js) to enforce
// the 2-linked-parents-per-student cap. api/auth/signup.js's own
// parent_student insert doesn't need this — it only ever targets the
// student row it just created in the same request, which structurally
// can't already have any links.
export async function countParentLinksForStudent(studentId) {
  const { count, error } = await supabase
    .from('parent_student')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
  if (error) throw error
  return count || 0
}

// Authorization guard for every parent mutation that targets a specific
// student (payout, resolve-bonus, per-student settings). Without this, a
// valid parent session token could act on ANY student_id in the request
// body, not just students actually linked to that parent.
export async function verifyStudentBelongsToParent(parentId, studentId) {
  const { data, error } = await supabase
    .from('parent_student')
    .select('student_id')
    .eq('parent_id', parentId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    const err = new Error('That student is not linked to your account.')
    err.status = 403
    err.code = 'FORBIDDEN'
    throw err
  }
}

export async function getParentWalletRow(parentId) {
  const { data, error } = await supabase
    .from('users')
    .select('wallet_balance_cents, total_added_cents, total_paid_out_cents, coin_to_dollar_rate, milestone_settings')
    .eq('id', parentId)
    .single()
  if (error) throw error
  return data
}

export function walletRowToJson(row) {
  return {
    walletBalanceCents: row.wallet_balance_cents,
    totalAddedCents: row.total_added_cents,
    totalPaidOutCents: row.total_paid_out_cents,
    coinToDollarRate: row.coin_to_dollar_rate,
    milestoneSettings: row.milestone_settings,
  }
}

// Mirrors getPayoutHistory in storage.js exactly, including its own
// independent username lookup (a payout can reference a student who was
// later unlinked, so it can't reuse the currently-linked students list).
export async function getPayoutHistoryRows(parentId) {
  const { data: rows, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const studentIds = [...new Set((rows || []).map((r) => r.student_id))]
  const usernameById = await usernameLookup(studentIds)

  return (rows || []).map((r) => ({
    id: r.id,
    studentUsername: usernameById[r.student_id] || 'Unknown',
    coins: r.coins,
    amountCents: r.amount_cents,
    type: r.type || 'manual',
    date: r.created_at.slice(0, 10),
  }))
}

export async function usernameLookup(userIds) {
  if (userIds.length === 0) return {}
  const { data, error } = await supabase.from('users').select('id, username').in('id', userIds)
  if (error) throw error
  return Object.fromEntries((data || []).map((u) => [u.id, u.username]))
}

// Core "cash out coins for real dollars" operation: deducts `coins` from the
// student's streaks.coin_balance and `amountCents` from the parent's
// wallet_balance_cents, then records a payouts row. Shared by
// api/parent/payout.js (parent-initiated, any amount up to the student's
// balance) and api/parent/resolve-payout-request.js (approving a request
// the student made) so the actual money-moving logic exists in exactly one
// place. Deliberately does NOT do authorization (verifyStudentBelongsToParent)
// or wallet-sufficiency checks — those differ slightly per caller (a
// request made hours ago needs its stored amount re-validated against
// CURRENT balances, not just the coin count) and are each caller's own
// responsibility before calling this.
export async function applyPayout({ parentId, studentId, coins, amountCents, type }) {
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
    type: type || 'manual',
  })
  if (payoutError) throw payoutError

  return { updatedWalletRow, newCoinBalance: streakRow.coin_balance - coins }
}

// The student-side mirror of verifyStudentBelongsToParent's lookup, queried
// from the student's end (by student_id) rather than requiring a parent id
// up front, since a student doesn't know their parent's id until this
// resolves. Returns an array (0-2 entries, one per linked parent — a
// student can have up to 2) rather than a single row/null, so callers can
// decide how to reconcile potentially-differing per-parent settings (see
// get-wallet.js's rate/cap display and request-payout.js's per-parent
// payout_requests rows) themselves. Used by api/student/get-wallet.js and
// api/student/request-payout.js. payout_cap_cents/payout_cap_period are
// nullable — no parent-facing settings UI sets them yet (not in this
// feature's scope), but the columns exist so the Wallet page's "if a cap is
// set" display logic has something real to check once one does.
export async function getParentLinksForStudent(studentId) {
  const { data, error } = await supabase
    .from('parent_student')
    .select('parent_id, payout_cap_cents, payout_cap_period')
    .eq('student_id', studentId)
  if (error) throw error
  return data || []
}

// Student-facing mirror of getPayoutHistoryRows above — same payouts
// table, scoped to student_id instead of parent_id. No username lookup
// needed since it's always the caller's own history.
export async function getPayoutHistoryForStudent(studentId) {
  const { data: rows, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (rows || []).map((r) => ({
    id: r.id,
    coins: r.coins,
    amountCents: r.amount_cents,
    type: r.type || 'manual',
    date: r.created_at.slice(0, 10),
  }))
}
