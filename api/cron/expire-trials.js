import { supabase } from '../_lib/auth.js'

// Once-daily bulk sweep — the actual source of truth for trial expiry is
// syncTrialExpiry (api/_lib/subscription.js), called on every login and
// get-profile fetch, so this cron is really just a safety net for accounts
// that don't log in or open the app again right as their trial lapses
// (their is_premium would otherwise stay stuck true indefinitely, since
// nothing else would ever trigger the per-request check). GET + Bearer
// $CRON_SECRET, matching every other cron in this codebase (streak-
// reminder.js, homework-reminder.js) and Vercel's own documented cron
// invocation method.
//
// Teachers excluded — getSubscriptionStatus already exempts them from
// premium checks unconditionally, regardless of is_premium's raw value, so
// flipping it here would be functionally harmless but a pointlessly
// confusing DB/admin-panel state for an account whose trial dates were
// never meant to mean anything.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed. Use GET.' })
    return
  }

  const expected = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || ''
  if (!expected || authHeader !== `Bearer ${expected}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { data: expired, error } = await supabase
      .from('users')
      .update({ is_premium: false })
      .lt('trial_ends_at', new Date().toISOString())
      .eq('is_premium', true)
      .eq('is_paying_subscriber', false)
      .neq('account_type', 'teacher')
      .select('id')
    if (error) throw error

    res.status(200).json({ expired: expired?.length || 0 })
  } catch (err) {
    console.error('[cron] expire-trials failed:', err)
    res.status(500).json({ error: 'Internal error' })
  }
}
