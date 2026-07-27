// Shared parent-domain helpers used across api/parent/*.js — mirrors the
// parent-related private/exported helpers in src/lib/storage.js the same
// way db.js mirrors the student ones (see db.js's header comment for why
// storage.js itself can't be imported directly here).
import { supabase } from './auth.js'

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
