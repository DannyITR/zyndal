import crypto from 'crypto'
import { createPublicHandler } from '../_lib/publicHandler.js'
import { createAdminToken, getAdminSecret } from '../_lib/adminAuth.js'
import { supabase } from '../_lib/auth.js'
import { hashPassword, comparePassword } from '../../src/lib/password.js'
import { sanitizeUsername } from '../_lib/sanitize.js'

// Constant-time comparison so a failed legacy-password attempt can't leak
// how many leading characters of ADMIN_PASSWORD the guess got right via
// response timing — same reasoning the old version of this file had.
function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// Every admin now has a real users-table row (account_type = 'admin'),
// individually attributable for messaging — not the old single hardcoded
// "admin" identity checked against the ADMIN_PASSWORD env var directly.
// Goes through createPublicHandler (not createAdminHandler) since, by
// definition, no admin token exists yet at login time — same reason
// api/auth/login.js uses createPublicHandler instead of a role handler.
// Its built-in rate limiting matters here specifically because this is a
// password-guessing surface.
function validate(body) {
  if (typeof body.username !== 'string' || !body.username) {
    return { field: 'username', message: 'Username is required.' }
  }
  if (typeof body.password !== 'string' || !body.password) {
    return { field: 'password', message: 'Password is required.' }
  }
  return null
}

function invalidCredentials() {
  const err = new Error('Invalid admin credentials.')
  err.status = 401
  err.code = 'INVALID_CREDENTIALS'
  return err
}

// A bcrypt hash can't be trimmed, so the typed password is tried as typed
// first (an admin whose real password has edge whitespace still works),
// then trimmed (a stray space from a paste or autofill doesn't lock anyone
// out).
async function matchesStoredHash(password, hash) {
  if (await comparePassword(password, hash)) return true
  const trimmed = password.trim()
  return trimmed !== password && comparePassword(trimmed, hash)
}

async function handle({ body }) {
  const password = body.password
  const trimmedPassword = password.trim()
  // Trimmed so a trailing space or newline pasted into the Vercel env var
  // doesn't make it impossible to match. Unset (or blank) means the
  // ADMIN_PASSWORD paths below are simply unavailable, never an empty
  // string that an empty password could match.
  const envSecret = getAdminSecret()
  if (!envSecret) console.error('[admin auth] ADMIN_PASSWORD is not set; only per-admin passwords can log in.')
  const matchesEnvSecret = Boolean(envSecret) && timingSafeStringEqual(trimmedPassword, envSecret)

  // sanitizeUsername lowercases/validates — admin usernames follow the
  // same ^[a-z0-9_]{3,20}$ shape as regular ones, no separate rule needed.
  // An invalid shape can never match a real row anyway, so this just skips
  // straight to the generic rejection below rather than erroring out
  // differently for a malformed username vs. a wrong one.
  const username = sanitizeUsername(body.username) || ''

  const { data: admin, error } = await supabase
    .from('users')
    .select('id, password')
    .eq('username', username)
    .eq('account_type', 'admin')
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error

  if (admin) {
    if (await matchesStoredHash(password, admin.password)) return createAdminToken(admin.id)

    // The legacy "admin" account also accepts the current ADMIN_PASSWORD.
    // Before this, ADMIN_PASSWORD was only read once, to create that row;
    // rotating it in Vercel afterwards changed nothing about the login, and
    // the row kept whatever password it was first created with. Not a new
    // way in: ADMIN_PASSWORD is already the key every admin token is signed
    // with (see adminAuth.js), so anyone holding it can mint tokens anyway.
    // The row's hash is re-synced to it so the two stop drifting apart.
    if (username === 'admin' && matchesEnvSecret) {
      const { error: syncError } = await supabase.from('users').update({ password: await hashPassword(trimmedPassword) }).eq('id', admin.id)
      if (syncError) console.error('[admin auth] could not re-sync the admin password hash:', syncError.message)
      return createAdminToken(admin.id)
    }
    throw invalidCredentials()
  }

  // No admin-type row exists for this username yet. One-time migration
  // path, pinned to the exact legacy identity (username "admin", the
  // fixed value the old hardcoded check required and AdminLogin.jsx's
  // field already defaults to) so an arbitrary attacker-chosen username
  // can never ride this path — only if NO admin row exists in the whole
  // table yet AND this login matches the legacy shared ADMIN_PASSWORD does
  // it silently create the first real admin account, using this same
  // password, instead of rejecting. Today's admin's login experience never
  // changes; every login after this one goes through the real per-admin
  // check above. This can only ever fire once, for whoever logs in first
  // after this migration ships.
  if (username === 'admin' && matchesEnvSecret) {
    const { count, error: countError } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('account_type', 'admin')
    if (countError) throw countError
    if (!count) {
      const { data: created, error: insertError } = await supabase
        .from('users')
        .insert({ username: 'admin', password: await hashPassword(trimmedPassword), account_type: 'admin', display_name: 'Admin' })
        .select('id')
        .single()
      if (insertError) throw insertError
      return createAdminToken(created.id)
    }
  }

  throw invalidCredentials()
}

export default createPublicHandler({ method: 'POST', validate, handle })
