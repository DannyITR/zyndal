import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { assertPremium } from '../_lib/subscription.js'
import { todayStr } from '../../src/lib/streak.js'

// Backs getActiveStudyPlan() in src/lib/storage.js — the most recent active
// plan whose test hasn't passed yet.
async function handle({ userId }) {
  await assertPremium(userId)
  const { data, error } = await supabase
    .from('study_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('test_date', todayStr())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export default createStudentHandler({ method: 'GET', handle })
