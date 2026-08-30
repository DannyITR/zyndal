import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'

// Public (no session) — needed because SignupForm.jsx shows the school
// picker before an account/session exists. domain is deliberately not
// selected: it's only used for the teacher-claim email-domain check
// (Phase 2), never shown to students.
async function handle() {
  const { data, error } = await supabase.from('schools').select('id, name').order('name', { ascending: true })
  if (error) throw error
  return { schools: data || [] }
}

export default createPublicHandler({ method: 'GET', handle })
