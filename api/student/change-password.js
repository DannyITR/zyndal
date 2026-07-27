import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { hashPassword, comparePassword, isBcryptHash } from '../../src/lib/password.js'

// Backs changePassword() in src/lib/storage.js, reusing the exact same
// pure bcrypt helpers (src/lib/password.js has no browser dependencies, so
// it's safe to import directly here) — including the silent legacy
// plain-text migration from the Session 1 password-hashing work: a current
// password that's still plain text is accepted and quietly rehashed, same
// as before.
function validate(body) {
  if (!body.current_password || typeof body.current_password !== 'string') return 'current_password is required.'
  if (!body.new_password || typeof body.new_password !== 'string' || body.new_password.length < 4) {
    return 'new_password is required and must be at least 4 characters.'
  }
  return null
}

async function handle({ userId, body }) {
  const { data: user, error: userError } = await supabase.from('users').select('id, password').eq('id', userId).maybeSingle()
  if (userError) throw userError
  if (!user) {
    const err = new Error('User not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const currentValid = isBcryptHash(user.password)
    ? await comparePassword(body.current_password, user.password)
    : user.password === body.current_password

  if (!currentValid) {
    const err = new Error('Current password is incorrect.')
    err.status = 400
    err.code = 'INVALID_PASSWORD'
    throw err
  }

  const hashedNew = await hashPassword(body.new_password)
  const { error: updateError } = await supabase.from('users').update({ password: hashedNew }).eq('id', userId)
  if (updateError) throw updateError

  return { success: true }
}

export default createStudentHandler({ method: 'POST', validate, handle })
