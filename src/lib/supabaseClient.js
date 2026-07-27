import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Kept in sync with storage.js's SESSION_KEY by hand — storage.js already
// imports this file, so importing back would be circular.
const SESSION_KEY = 'zyndal_session'

// Attaches the current device's session token (see createSession in
// storage.js) to every Supabase request as a custom header. Read fresh from
// localStorage per request, via a custom `fetch`, rather than baked into a
// static headers object at client-creation time — that way a login/logout
// in this tab takes effect on the very next request without needing to
// recreate the client. Nothing server-side reads this header yet (no RLS
// policy or serverless function validates it) — this only wires the token
// through so that work can land without another client-side change.
function fetchWithSessionToken(url, options = {}) {
  let token = null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    token = raw ? JSON.parse(raw).token : null
  } catch {
    // Best-effort — request just goes out without the header.
  }
  const headers = new Headers(options.headers)
  if (token) headers.set('X-Session-Token', token)
  return fetch(url, { ...options, headers })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithSessionToken },
})
