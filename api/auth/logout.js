import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'

// Session 5: mirrors clearSession's server-side delete in the pre-RLS
// src/lib/storage.js. Deliberately doesn't go through requireAuth — a token
// that's already expired or was already deleted should still make this a
// harmless no-op (same best-effort semantics as before: the client clears
// its local session immediately regardless of whether this call succeeds),
// and requireAuth would reject an already-invalid token before we ever got
// the chance to delete it.
function validate(body) {
  if (!body.token || typeof body.token !== 'string') return 'token is required.'
  return null
}

async function handle({ body }) {
  const { error } = await supabase.from('sessions').delete().eq('token', body.token)
  if (error) throw error
  return { success: true }
}

export default createPublicHandler({ method: 'POST', validate, handle })
