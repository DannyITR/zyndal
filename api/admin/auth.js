import crypto from 'crypto'
import { createPublicHandler } from '../_lib/publicHandler.js'
import { createAdminToken } from '../_lib/adminAuth.js'
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

async function handle({ body }) {
  const { password } = body
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
    const valid = await comparePassword(password, admin.password)
    if (!valid) {
      const err = new Error('Invalid admin credentials.')
      err.status = 401
      err.code = 'INVALID_CREDENTIALS'
      throw err
    }
    return createAdminToken(admin.id)
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
  const legacySecret = process.env.ADMIN_PASSWORD
  if (username === 'admin' && legacySecret && timingSafeStringEqual(password, legacySecret)) {
    const { count, error: countError } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('account_type', 'admin')
    if (countError) throw countError
    if (!count) {
      const { data: created, error: insertError } = await supabase
        .from('users')
        .insert({ username: 'admin', password: await hashPassword(password), account_type: 'admin', display_name: 'Admin' })
        .select('id')
        .single()
      if (insertError) throw insertError
      return createAdminToken(created.id)
    }
  }

  const err = new Error('Invalid admin credentials.')
  err.status = 401
  err.code = 'INVALID_CREDENTIALS'
  throw err
}

export default createPublicHandler({ method: 'POST', validate, handle })
