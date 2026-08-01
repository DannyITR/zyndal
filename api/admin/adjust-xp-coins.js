import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeInteger, sanitizeString } from '../_lib/sanitize.js'

function validate(body) {
  const userId = sanitizeUuid(body.user_id)
  if (!userId) return { field: 'user_id', message: 'A valid user_id is required.' }
  body.user_id = userId

  if (body.total_xp !== undefined && body.total_xp !== null && body.total_xp !== '') {
    const xp = sanitizeInteger(body.total_xp, 0, 1000000)
    if (xp === null) return { field: 'total_xp', message: 'total_xp must be a whole number, 0 or greater.' }
    body.total_xp = xp
  } else {
    body.total_xp = undefined
  }

  if (body.coin_balance !== undefined && body.coin_balance !== null && body.coin_balance !== '') {
    const coins = sanitizeInteger(body.coin_balance, 0, 1000000)
    if (coins === null) return { field: 'coin_balance', message: 'coin_balance must be a whole number, 0 or greater.' }
    body.coin_balance = coins
  } else {
    body.coin_balance = undefined
  }

  if (body.total_xp === undefined && body.coin_balance === undefined) {
    return { field: 'total_xp', message: 'At least one of total_xp or coin_balance is required.' }
  }

  body.reason = body.reason ? sanitizeString(body.reason, 500) : ''
  return null
}

async function handle({ body }) {
  const updates = {}
  if (body.total_xp !== undefined) updates.total_xp = body.total_xp
  if (body.coin_balance !== undefined) updates.coin_balance = body.coin_balance

  const { data: existing, error: existingError } = await supabase.from('streaks').select('id').eq('user_id', body.user_id).maybeSingle()
  if (existingError) throw existingError

  let result
  if (existing) {
    const { data, error } = await supabase.from('streaks').update(updates).eq('user_id', body.user_id).select().maybeSingle()
    if (error) throw error
    result = data
  } else {
    const { data, error } = await supabase
      .from('streaks')
      .insert({ user_id: body.user_id, ...updates })
      .select()
      .maybeSingle()
    if (error) throw error
    result = data
  }

  // No audit-log table exists for admin actions (this feature is SQL-free
  // by design) — logging the reason here at least puts it in Vercel's
  // function logs instead of discarding it outright.
  console.log(`[admin] adjusted XP/coins for user ${body.user_id}:`, updates, '— reason:', body.reason || '(none given)')

  return {
    streak: {
      currentStreak: result.current_streak,
      longestStreak: result.longest_streak,
      totalXp: result.total_xp,
      coinBalance: result.coin_balance,
    },
  }
}

export default createAdminHandler({ method: 'POST', validate, handle })
