import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeString, sanitizeAccountType } from '../_lib/sanitize.js'
import { getSubscriptionStatus } from '../_lib/subscription.js'

const USER_COLUMNS =
  'id, username, email, account_type, grade, is_premium, email_verified, created_at, deleted_at, trial_ends_at, is_paying_subscriber, last_active_at'
const MAX_LIMIT = 200

// Only real, indexed columns belong here — .order() can't sort on a
// computed expression, and this string reaches the query builder directly
// so it must never be built from unvalidated input.
const SORTABLE_COLUMNS = new Set(['created_at', 'last_active_at'])

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

  const sortColumn = SORTABLE_COLUMNS.has(body.sort) ? body.sort : 'created_at'
  const ascending = body.sort_dir === 'asc'

  let query = supabase
    .from('users')
    .select(USER_COLUMNS, { count: 'exact' })
    // last_active_at is nullable (a user who's never logged in or answered a
    // question) — nullsFirst: false regardless of direction, so "Never"
    // users always sink to the bottom instead of Postgres's default of
    // NULLS FIRST on descending order (which would otherwise put them
    // ahead of the most-recently-active users).
    .order(sortColumn, { ascending, nullsFirst: false })
    .range(from, to)

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
  const { data: streakRows, error: streakError } = await supabase
    .from('streaks')
    .select('user_id, current_streak, total_xp, coin_balance')
    .in('user_id', userIds)
  if (streakError) throw streakError

  const streakByUser = Object.fromEntries((streakRows || []).map((s) => [s.user_id, s]))

  const enriched = users.map((u) => ({
    ...u,
    current_streak: streakByUser[u.id]?.current_streak ?? 0,
    total_xp: streakByUser[u.id]?.total_xp ?? 0,
    coin_balance: streakByUser[u.id]?.coin_balance ?? 0,
    ...getSubscriptionStatus(u),
  }))

  return { users: enriched, page, limit, total, totalPages }
}

export default createAdminHandler({ method: 'GET', handle })
