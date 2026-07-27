import { createClient } from '@supabase/supabase-js'

// Same public Supabase project the client already uses — the VITE_ prefix
// only controls whether Vite bundles a var into client code; process.env
// still has it available here server-side. RLS is not yet enabled on these
// tables (see the deferred RLS SQL from the Session 1 password-hashing
// work), so this behaves identically to direct client access today; once
// RLS lands, these functions will need a service-role key instead.
export const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

// Validates X-Session-Token against the sessions table — the server-side
// mirror of getCurrentUser's check in src/lib/storage.js. Returns the
// user_id for a valid, unexpired session, or null otherwise.
export async function getUserIdFromToken(token) {
  if (!token) return null
  const { data: session, error } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (error || !session) return null
  if (new Date(session.expires_at) <= new Date()) return null
  return session.user_id
}

// Shared auth check for every /api/student and /api/questions endpoint:
// `const userId = await requireAuth(req, res); if (!userId) return`
// Responds 401 with the standard { error, code } shape itself, so callers
// only need the early-return line above.
export async function requireAuth(req, res) {
  const token = req.headers['x-session-token']
  const userId = await getUserIdFromToken(token)
  if (!userId) {
    res.status(401).json({ error: 'Invalid or expired session.', code: 'UNAUTHENTICATED' })
    return null
  }
  return userId
}
