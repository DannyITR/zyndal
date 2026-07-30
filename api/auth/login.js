import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'
import { SAFE_USER_COLUMNS, isLinkedParentDeleted } from '../_lib/db.js'
import { hashPassword, comparePassword, isBcryptHash } from '../../src/lib/password.js'
import { sanitizeUsername } from '../_lib/sanitize.js'

// Session 5: mirrors verifyLogin + the silent legacy-plaintext migration
// (verifyAndMigratePassword) + createSession from the pre-RLS
// src/lib/storage.js — all pre-auth, so all had to move here rather than
// behind a session-authenticated handler. Returns the generic "Invalid
// username or password" message either way (unknown username vs. wrong
// password) so this can't be used to enumerate valid usernames.
//
// sanitizeUsername lowercases + restricts to [a-z0-9_]{3,20} — checked
// against the live users table before relying on it here: all real accounts
// already fit that pattern, so this can't lock anyone out of an existing
// account (nothing has ever let a username be created outside it, since
// api/auth/signup.js enforces the same pattern on the way in).
function validate(body) {
  if (!body.password || typeof body.password !== 'string') {
    return { field: 'password', message: 'password is required.' }
  }
  const username = sanitizeUsername(body.username)
  if (!username) {
    return { field: 'username', message: 'username is required.' }
  }
  body.username = username
  return null
}

function invalidCredentialsError() {
  const err = new Error('Invalid username or password.')
  err.status = 401
  err.code = 'INVALID_CREDENTIALS'
  return err
}

// Deliberately checked before the password — a returning user who no longer
// remembers their exact password still needs to see this (that's the whole
// point: it tells them to email support instead of endlessly retrying), and
// unlike a wrong-password attempt this isn't account enumeration risk in any
// meaningful new way — a deleted username is already effectively "known"
// the moment someone who used to know it tries to log back in.
function accountDeletedError() {
  const err = new Error('Account deactivated')
  err.status = 401
  err.code = 'ACCOUNT_DELETED'
  err.userMessage = 'This account has been deleted. Email hello@zyndal.ca within 90 days to restore it.'
  return err
}

async function handle({ body }) {
  const { data: user, error } = await supabase
    .from('users')
    .select(`${SAFE_USER_COLUMNS}, password, deleted_at`)
    .ilike('username', body.username)
    .maybeSingle()
  if (error) throw error
  if (!user) throw invalidCredentialsError()
  if (user.deleted_at) throw accountDeletedError()

  const valid = isBcryptHash(user.password) ? await comparePassword(body.password, user.password) : user.password === body.password
  if (!valid) throw invalidCredentialsError()

  if (!isBcryptHash(user.password)) {
    const hashed = await hashPassword(body.password)
    const { error: migrateError } = await supabase.from('users').update({ password: hashed }).eq('id', user.id)
    if (migrateError) console.error('[api] silent password migration failed:', migrateError)
  }

  const token = crypto.randomUUID()
  const { error: sessionError } = await supabase.from('sessions').insert({ user_id: user.id, token })
  if (sessionError) throw sessionError

  const { password: _password, deleted_at: _deletedAt, ...safeUser } = user
  if (safeUser.account_type === 'student') {
    safeUser.linked_parent_deleted = await isLinkedParentDeleted(user.id)
  }
  return { user: safeUser, token }
}

export default createPublicHandler({ method: 'POST', validate, handle })
