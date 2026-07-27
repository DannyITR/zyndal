import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'
import { SAFE_USER_COLUMNS } from '../_lib/db.js'
import { hashPassword } from '../../src/lib/password.js'
import { sanitizeUsername, sanitizeAccountType, sanitizeGrade } from '../_lib/sanitize.js'

// Session 5: the whole SignupForm.jsx flow (username-uniqueness check,
// parent-code lookup, parent-code generation, user creation, streak-row
// creation, parent<->student linking, session issuance) collapses into one
// call — it all has to happen before a session token exists, so none of it
// could live behind the session-authenticated /api/student or /api/parent
// handlers, and RLS blocks the client from doing any of it directly anymore
// (the anon key can no longer read/write `users` at all). Mirrors
// createUser/findUserByUsername/findUserByParentCode/linkParentAndStudent/
// createSession/generateParentCode from the pre-RLS src/lib/storage.js and
// src/lib/codes.js, which are removed now that nothing calls them directly.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I — matches the removed codes.js

function randomCode(length = 6) {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return code
}

async function generateUniqueParentCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode()
    const { data, error } = await supabase.from('users').select('id').eq('parent_code', code).maybeSingle()
    if (error) throw error
    if (!data) return code
  }
  const err = new Error('Could not generate a unique parent code. Please try again.')
  err.status = 500
  err.code = 'SERVER_ERROR'
  throw err
}

function validate(body) {
  if (!body.password || typeof body.password !== 'string' || body.password.length < 4) {
    return { field: 'password', message: 'Password must be at least 4 characters.' }
  }

  const username = sanitizeUsername(body.username)
  if (!username) {
    return { field: 'username', message: 'Username must be 3-20 characters — letters, numbers, and underscores only.' }
  }
  body.username = username

  const accountType = sanitizeAccountType(body.account_type)
  if (!accountType) {
    return { field: 'account_type', message: "account_type must be 'student' or 'parent'." }
  }
  body.account_type = accountType

  if (body.grade !== undefined && body.grade !== null && body.grade !== '') {
    const grade = sanitizeGrade(body.grade)
    if (grade === null) {
      return { field: 'grade', message: 'grade must be 9, 10, or 11.' }
    }
    body.grade = grade
  }

  return null
}

async function handle({ body }) {
  const username = body.username
  const accountType = body.account_type
  const grade = accountType === 'student' && body.grade ? body.grade : null

  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id')
    .ilike('username', username)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) {
    const err = new Error('That username is already taken.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  let linkedParent = null
  if (accountType === 'student' && body.parent_code && String(body.parent_code).trim()) {
    const { data: parent, error: parentError } = await supabase
      .from('users')
      .select('id')
      .eq('account_type', 'parent')
      .eq('parent_code', String(body.parent_code).trim().toUpperCase())
      .maybeSingle()
    if (parentError) throw parentError
    if (!parent) {
      const err = new Error('That parent code was not found.')
      err.status = 400
      err.code = 'VALIDATION_ERROR'
      throw err
    }
    linkedParent = parent
  }

  const hashedPassword = await hashPassword(body.password)
  const parentCode = accountType === 'parent' ? await generateUniqueParentCode() : null

  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({ username, password: hashedPassword, account_type: accountType, grade, parent_code: parentCode })
    .select(SAFE_USER_COLUMNS)
    .single()
  if (insertError) throw insertError

  if (accountType === 'student') {
    const { error: streakError } = await supabase.from('streaks').insert({ user_id: newUser.id })
    if (streakError) throw streakError
  }

  if (linkedParent) {
    const { error: linkError } = await supabase.from('parent_student').insert({ parent_id: linkedParent.id, student_id: newUser.id })
    if (linkError) throw linkError
  }

  const token = crypto.randomUUID()
  const { error: sessionError } = await supabase.from('sessions').insert({ user_id: newUser.id, token })
  if (sessionError) throw sessionError

  return { user: newUser, token }
}

export default createPublicHandler({ method: 'POST', validate, handle })
