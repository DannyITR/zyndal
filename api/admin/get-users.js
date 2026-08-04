import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeString, sanitizeAccountType } from '../_lib/sanitize.js'
import { getSubscriptionStatus } from '../_lib/subscription.js'

const USER_COLUMNS =
  'id, username, email, account_type, grade, is_premium, email_verified, created_at, deleted_at, trial_ends_at, is_paying_subscriber'
const MAX_LIMIT = 200

function handleIsPremiumFilter(query, raw) {
  if (raw === 'true') return query.eq('is_premium', true)
  if (raw === 'false') return query.eq('is_premium', false)
  return query
}

async function handle({ body }) {
  const page = Math.max(1, parseInt(body.page, 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(body.limit, 10) || 50))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase.from('users').select(USER_COLUMNS, { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)

  const search = sanitizeString(body.search, 100)
  if (search) query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`)

  const accountType = sanitizeAccountType(body.account_type)
  if (accountType) query = query.eq('account_type', accountType)

  query = handleIsPremiumFilter(query, body.is_premium)

  const { data: users, count, error } = await query
  if (error) throw error

  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / limit))
  if (!users || users.length === 0) {
    return { users: [], page, limit, total, totalPages }
  }

  const userIds = users.map((u) => u.id)
  const [{ data: streakRows, error: streakError }, { data: answerRows, error: answerError }] = await Promise.all([
    supabase.from('streaks').select('user_id, current_streak, total_xp, coin_balance').in('user_id', userIds),
    // Most-recent-first so the first row seen per user in the reduce below
    // is their actual last activity.
    supabase.from('answers').select('user_id, answered_at').in('user_id', userIds).order('answered_at', { ascending: false }),
  ])
  if (streakError) throw streakError
  if (answerError) throw answerError

  const streakByUser = Object.fromEntries((streakRows || []).map((s) => [s.user_id, s]))
  const lastActiveByUser = {}
  for (const row of answerRows || []) {
    if (!lastActiveByUser[row.user_id]) lastActiveByUser[row.user_id] = row.answered_at
  }

  const enriched = users.map((u) => ({
    ...u,
    current_streak: streakByUser[u.id]?.current_streak ?? 0,
    total_xp: streakByUser[u.id]?.total_xp ?? 0,
    coin_balance: streakByUser[u.id]?.coin_balance ?? 0,
    last_active: lastActiveByUser[u.id] || null,
    ...getSubscriptionStatus(u),
  }))

  return { users: enriched, page, limit, total, totalPages }
}

export default createAdminHandler({ method: 'GET', handle })
