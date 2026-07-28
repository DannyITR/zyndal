import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'
import { SAFE_USER_COLUMNS, isLinkedParentDeleted } from '../_lib/db.js'
import { hashPassword } from '../../src/lib/password.js'

// Session: social login (Google/Facebook). Companion to
// api/auth/oauth-merge.js. Deliberately a brand-new file rather than a
// change to api/auth/login.js/signup.js, which must stay untouched — the
// existing username/password flow doesn't know this table or these
// endpoints exist.
//
// The client sends provider/provider_user_id/provider_email/provider_name
// straight from the browser's Supabase Auth session, but NONE of that is
// trusted as identity — a client could claim to be anyone. The only thing
// trusted is supabase_access_token, which this handler verifies directly
// against Supabase Auth (supabase.auth.getUser), then cross-checks the
// claimed provider/provider_user_id against that verified session's own
// linked identities. Every downstream decision (which user this is, what
// email to store) uses the server-verified values, not the client-supplied
// ones — see verifyOAuthIdentity below.

const PROVIDERS = ['google', 'facebook']
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/

function validate(body) {
  if (!PROVIDERS.includes(body.provider)) {
    return { field: 'provider', message: "provider must be 'google' or 'facebook'." }
  }
  if (!body.supabase_access_token || typeof body.supabase_access_token !== 'string') {
    return { field: 'supabase_access_token', message: 'supabase_access_token is required.' }
  }
  return null
}

function oauthVerificationError(message) {
  const err = new Error(message)
  err.status = 401
  err.code = 'INVALID_OAUTH_TOKEN'
  return err
}

function accountDeletedError() {
  const err = new Error('Account deactivated')
  err.status = 401
  err.code = 'ACCOUNT_DELETED'
  err.userMessage = 'This account has been deleted. Email hello@zyndal.com within 90 days to restore it.'
  return err
}

// Verifies the access token against Supabase Auth itself (this is the only
// step that actually proves anything — everything else in this file is
// derived from its result) and confirms the requested provider is one of
// the identities actually linked to that verified session. Returns the
// server-verified { providerUserId, email, name } — callers must use these,
// never the client-submitted provider_user_id/provider_email/provider_name.
async function verifyOAuthIdentity(provider, accessToken) {
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data?.user) {
    throw oauthVerificationError('Could not verify your sign-in. Please try again.')
  }
  const authUser = data.user

  const identity = (authUser.identities || []).find((i) => i.provider === provider)
  if (!identity) {
    throw oauthVerificationError(`No linked ${provider} identity found for this sign-in.`)
  }

  const email = authUser.email || identity.identity_data?.email
  if (!email) {
    throw oauthVerificationError(
      `${provider === 'google' ? 'Google' : 'Facebook'} did not share an email address for this account. Please use a different sign-in method.`
    )
  }

  const name =
    authUser.user_metadata?.full_name || authUser.user_metadata?.name || identity.identity_data?.full_name || identity.identity_data?.name || null

  return { providerUserId: identity.id, email, name }
}

function baseUsernameFromName(name, email) {
  const source = name || (email ? email.split('@')[0] : '')
  const cleaned = String(source)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20)
  return USERNAME_PATTERN.test(cleaned) ? cleaned : 'zyndal_user'
}

async function generateUniqueUsername(name, email) {
  const base = baseUsernameFromName(name, email)
  const { data: existing, error } = await supabase.from('users').select('id').ilike('username', base).maybeSingle()
  if (error) throw error
  if (!existing) return base

  for (let attempt = 0; attempt < 15; attempt++) {
    const suffix = String(Math.floor(1000 + Math.random() * 9000))
    const candidate = `${base.slice(0, 20 - suffix.length - 1)}_${suffix}`
    const { data: taken, error: checkError } = await supabase.from('users').select('id').ilike('username', candidate).maybeSingle()
    if (checkError) throw checkError
    if (!taken) return candidate
  }
  const err = new Error('Could not create a username for your account. Please try again.')
  err.status = 500
  err.code = 'SERVER_ERROR'
  throw err
}

async function issueSession(userId) {
  const token = crypto.randomUUID()
  const { error } = await supabase.from('sessions').insert({ user_id: userId, token })
  if (error) throw error
  return token
}

async function handle({ body }) {
  const { provider } = body
  const { providerUserId, email, name } = await verifyOAuthIdentity(provider, body.supabase_access_token)

  // A. Already linked — log straight in.
  const { data: existingIdentity, error: identityError } = await supabase
    .from('oauth_identities')
    .select('user_id')
    .eq('provider', provider)
    .eq('provider_user_id', providerUserId)
    .maybeSingle()
  if (identityError) throw identityError

  if (existingIdentity) {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`${SAFE_USER_COLUMNS}, deleted_at`)
      .eq('id', existingIdentity.user_id)
      .maybeSingle()
    if (userError) throw userError
    if (!user) throw oauthVerificationError('This account no longer exists.')
    if (user.deleted_at) throw accountDeletedError()

    const token = await issueSession(user.id)
    const { deleted_at: _deletedAt, ...safeUser } = user
    if (safeUser.account_type === 'student') {
      safeUser.linked_parent_deleted = await isLinkedParentDeleted(user.id)
    }
    return { success: true, token, user: safeUser, is_new_user: false }
  }

  // B. No identity link yet, but an account already uses this email —
  // don't silently attach a stranger's OAuth login to it. Send the client
  // to the merge flow instead, which requires proving the existing
  // account's password.
  const { data: emailMatch, error: emailError } = await supabase
    .from('users')
    .select('id, username, deleted_at')
    .ilike('email', email)
    .maybeSingle()
  if (emailError) throw emailError

  if (emailMatch) {
    if (emailMatch.deleted_at) throw accountDeletedError()
    return {
      needs_merge: true,
      existing_username: emailMatch.username,
      provider_email: email,
      provider_name: name,
      provider_user_id: providerUserId,
      provider,
    }
  }

  // C. Brand-new account. The password column stays bcrypt-hashed like
  // every other row (never a raw placeholder value) even though it's
  // unusable — a random UUID hashed the normal way costs nothing extra and
  // means there is no code path in this app where an un-hashed password
  // ever sits in that column.
  const username = await generateUniqueUsername(name, email)
  const placeholderPassword = await hashPassword(crypto.randomUUID())

  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      username,
      password: placeholderPassword,
      account_type: 'student',
      email,
      email_verified: true,
    })
    .select(SAFE_USER_COLUMNS)
    .single()
  if (insertError) throw insertError

  const { error: streakError } = await supabase.from('streaks').insert({ user_id: newUser.id })
  if (streakError) throw streakError

  const { error: linkError } = await supabase.from('oauth_identities').insert({
    user_id: newUser.id,
    provider,
    provider_user_id: providerUserId,
    provider_email: email,
    provider_name: name,
  })
  if (linkError) throw linkError

  const token = await issueSession(newUser.id)
  return { success: true, token, user: newUser, is_new_user: true }
}

export default createPublicHandler({ method: 'POST', validate, handle })
