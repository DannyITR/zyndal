import { createClient } from '@supabase/supabase-js'

// ONLY for OAuth (signInWithOAuth / getSession on /auth/callback). Every
// other piece of this app talks to Supabase through our own /api endpoints
// (see storage.js) — RLS blocks the anon key from reading or writing tables
// directly, and nothing here should ever call supabase.from(...). This
// client exists purely so the browser can hand off to Google/Facebook and
// get a verified session back; api/auth/oauth-callback.js and
// api/auth/oauth-merge.js are what turn that into an actual Zyndal login.
export const supabaseAuth = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    // This app has its own session system (see storage.js's SESSION_KEY) —
    // Supabase Auth's own session is only needed transiently, to carry the
    // access token from redirect back to oauth-callback.js. Persisting it
    // would create a second, redundant "am I logged in" source of truth
    // that could drift from the real one (e.g. after Delete My Account,
    // which has no reason to know about a lingering Supabase Auth session).
    persistSession: false,
    // The OAuth redirect itself is how the session token actually arrives
    // (in the URL after Google/Facebook sends the browser back) — this flag
    // just controls whether the SDK parses that URL automatically.
    detectSessionInUrl: true,
  },
})
