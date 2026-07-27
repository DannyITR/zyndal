import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'
import { SAFE_USER_COLUMNS } from '../_lib/db.js'
import { hashPassword, comparePassword, isBcryptHash } from '../../src/lib/password.js'

// Session 5: mirrors verifyLogin + the silent legacy-plaintext migration
// (verifyAndMigratePassword) + createSession from the pre-RLS
// src/lib/storage.js — all pre-auth, so all had to move here rather than
// behind a session-authenticated handler. Returns the generic "Invalid
// username or password" message either way (unknown username vs. wrong
// password) so this can't be used to enumerate valid usernames.
function validate(body) {
  if (!body.username || typeof body.username !== 'string') return 'username is required.'
  if (!body.password || typeof body.password !== 'string') return 'password is required.'
  return null
}

function invalidCredentialsError() {
  const err = new Error('Invalid username or password.')
  err.status = 401
  err.code = 'INVALID_CREDENTIALS'
  return err
}

async function handle({ body }) {
  const { data: user, error } = await supabase
    .from('users')
    .select(`${SAFE_USER_COLUMNS}, password`)
    .ilike('username', body.username.trim())
    .maybeSingle()
  if (error) throw error
  if (!user) throw invalidCredentialsError()

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

  const { password: _password, ...safeUser } = user
  return { user: safeUser, token }
}

export default createPublicHandler({ method: 'POST', validate, handle })
