import { createClient } from '@supabase/supabase-js'

// Session 5: RLS is enabled on every table (see supabase/schema.sql), so the
// anon key the browser uses is now blocked by default — every /api/* function
// authenticates the caller itself (see requireAuth below) and then needs to
// read/write ANY row those policies would otherwise hide from an anonymous
// client (e.g. a parent's linked student's row, or the row matching a
// session token before that token has proven anything). The service-role key
// bypasses RLS entirely, which is safe here specifically because every
// serverless function using this client already re-implements the
// authorization RLS would have done (requireAuth + explicit ownership checks
// like verifyStudentBelongsToParent) — this key must never be exposed to the
// browser, hence no VITE_ prefix.
export const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

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
