import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'
import { SAFE_USER_COLUMNS } from '../_lib/db.js'
import { TRIAL_DAYS, getSubscriptionStatus } from '../_lib/subscription.js'
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
      return { field: 'grade', message: 'grade must be 7, 8, 9, 10, or 11.' }
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
    const err = new Error('Username already taken')
    err.status = 400
    err.code = 'USERNAME_TAKEN'
    err.userMessage = 'This username is already in use. Please choose a different one.'
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
  // Teacher accounts are routed into the same ParentDashboard as parent
  // accounts (teacher-specific class features are a future session), so
  // they need a parent_code too or the dashboard has nothing to show/share.
  const parentCode = accountType === 'parent' || accountType === 'teacher' ? await generateUniqueParentCode() : null

  // Every new signup — student, parent, or teacher — gets a 30-day
  // Premium trial, no card required. is_premium starts true; the daily
  // api/cron/expire-trials.js job (plus the same check on every
  // login/get-profile, via syncTrialExpiry) is what turns it back off once
  // trial_ends_at passes, unless is_paying_subscriber is set by then.
  const trialStartedAt = new Date()
  const trialEndsAt = new Date(trialStartedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      username,
      password: hashedPassword,
      account_type: accountType,
      grade,
      parent_code: parentCode,
      trial_started_at: trialStartedAt.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      is_premium: true,
      // A brand-new signup is issued a session immediately below — that's
      // an effective first login, so it counts the same as one for the
      // admin panel's Last Active column.
      last_login_at: trialStartedAt.toISOString(),
    })
    .select(SAFE_USER_COLUMNS)
    .single()
  if (insertError) throw insertError

  Object.assign(newUser, getSubscriptionStatus(newUser))

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
