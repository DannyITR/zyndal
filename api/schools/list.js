import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'

// Public (no session) — needed because SignupForm.jsx shows the school
// picker before an account/session exists. domain is included (not
// sensitive — a school board's public staff-email domain) since
// ClaimClassModal.jsx needs it to show/validate a teacher's email match.
async function handle() {
  const { data, error } = await supabase.from('schools').select('id, name, domain').order('name', { ascending: true })
  if (error) throw error
  return { schools: data || [] }
}

export default createPublicHandler({ method: 'GET', handle })
