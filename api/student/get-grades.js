import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

// Backs getGradesForUser() in src/lib/storage.js — the caller's own manually
// logged grades, newest test first.
async function handle({ userId }) {
  const { data, error } = await supabase.from('grades').select('*').eq('user_id', userId).order('test_date', { ascending: false })
  if (error) throw error
  return data || []
}

export default createStudentHandler({ method: 'GET', handle })
