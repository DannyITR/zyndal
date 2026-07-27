import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

// Backs getPastStudyPlans() in src/lib/storage.js — completed and cancelled
// plans, most recent test first.
async function handle({ userId }) {
  const { data, error } = await supabase
    .from('study_plans')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['completed', 'cancelled'])
    .order('test_date', { ascending: false })
  if (error) throw error
  return data || []
}

export default createStudentHandler({ method: 'GET', handle })
