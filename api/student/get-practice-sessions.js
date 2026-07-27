import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

// Backs getRecentPracticeSessions() in src/lib/storage.js.
function validate(body) {
  if (body.limit !== undefined && (!Number.isFinite(Number(body.limit)) || Number(body.limit) <= 0)) {
    return 'limit must be a positive number.'
  }
  return null
}

async function handle({ userId, body }) {
  const limit = body.limit ? Number(body.limit) : 5
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export default createStudentHandler({ method: 'GET', validate, handle })
