import { createPublicHandler } from '../_lib/publicHandler.js'
import { supabase } from '../_lib/auth.js'
import { SAFE_USER_COLUMNS, getLinkedParentStatus } from '../_lib/db.js'
import { comparePassword, isBcryptHash } from '../../src/lib/password.js'
import { sanitizeUsername } from '../_lib/sanitize.js'

// Companion to api/auth/oauth-callback.js's `needs_merge: true` response —
// links a Google/Facebook identity to an EXISTING username/password
// account, gated on proving the account's password.
//
// Deviation worth flagging: the task spec for this endpoint's request body
// didn't include supabase_access_token, only
// { provider, provider_user_id, provider_email, existing_username,
// existing_password }. This file still requires and verifies
// supabase_access_token (same supabase.auth.getUser check as
// oauth-callback.js) and derives provider/provider_user_id/provider_email
// from THAT, ignoring the client-submitted versions of those three fields —
// otherwise a client could link an arbitrary, unverified (provider,
// provider_user_id) pair to any account whose password it can prove
// knowledge of, which is exactly the "never trust client-supplied identity"
// risk the spec called out for the sibling endpoint. existing_username and
// existing_password are the only client-submitted values actually trusted
// here, because they're gated by the bcrypt check below, not merely echoed.
const PROVIDERS = ['google', 'facebook']

function validate(body) {
  if (!PROVIDERS.includes(body.provider)) {
    return { field: 'provider', message: "provider must be 'google' or 'facebook'." }
  }
  if (!body.supabase_access_token || typeof body.supabase_access_token !== 'string') {
    return { field: 'supabase_access_token', message: 'supabase_access_token is required.' }
  }
  const username = sanitizeUsername(body.existing_username)
  if (!username) {
    return { field: 'existing_username', message: 'existing_username is required.' }
  }
  body.existing_username = username
  if (!body.existing_password || typeof body.existing_password !== 'string') {
    return { field: 'existing_password', message: 'existing_password is required.' }
  }
  return null
}

function oauthVerificationError(message) {
  const err = new Error(message)
  err.status = 401
  err.code = 'INVALID_OAUTH_TOKEN'
  return err
}

function incorrectPasswordError() {
  const err = new Error('Incorrect password for existing account.')
  err.status = 401
  err.code = 'INVALID_CREDENTIALS'
  return err
}

// Identical verification step to oauth-callback.js's verifyOAuthIdentity —
// duplicated rather than imported since these are two separate serverless
// functions (each Vercel function bundles its own dependency graph; a
// shared helper still belongs in api/_lib, but this file is small enough,
// and specific enough to this merge flow's error messages, that a shared
// extraction wasn't worth it here).
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

async function handle({ body }) {
  const { provider, existing_username: username, existing_password: password } = body
  const { providerUserId, email, name } = await verifyOAuthIdentity(provider, body.supabase_access_token)

  const { data: user, error: userError } = await supabase
    .from('users')
    .select(`${SAFE_USER_COLUMNS}, password, deleted_at`)
    .ilike('username', username)
    .maybeSingle()
  if (userError) throw userError
  if (!user) throw incorrectPasswordError() // same generic error as a wrong password — don't reveal whether the username exists
  if (user.deleted_at) {
    const err = new Error('Account deactivated')
    err.status = 401
    err.code = 'ACCOUNT_DELETED'
    err.userMessage = 'This account has been deleted. Email hello@zyndal.ca within 90 days to restore it.'
    throw err
  }

  const valid = isBcryptHash(user.password) ? await comparePassword(password, user.password) : user.password === password
  if (!valid) throw incorrectPasswordError()

  // Idempotent: if this exact (provider, provider_user_id) is already
  // linked to this same user (a retried request after a dropped response,
  // say), just issue a fresh session instead of erroring on the unique
  // constraint. If it's linked to a DIFFERENT user, that's a genuine
  // conflict — surface it rather than silently reassigning the identity.
  const { data: existingLink, error: existingLinkError } = await supabase
    .from('oauth_identities')
    .select('user_id')
    .eq('provider', provider)
    .eq('provider_user_id', providerUserId)
    .maybeSingle()
  if (existingLinkError) throw existingLinkError

  if (existingLink && existingLink.user_id !== user.id) {
    const err = new Error('This social account is already linked to a different Zyndal account.')
    err.status = 409
    err.code = 'ALREADY_LINKED'
    throw err
  }

  if (!existingLink) {
    const { error: linkError } = await supabase.from('oauth_identities').insert({
      user_id: user.id,
      provider,
      provider_user_id: providerUserId,
      provider_email: email,
      provider_name: name,
    })
    if (linkError) throw linkError
  }

  const token = crypto.randomUUID()
  const { error: sessionError } = await supabase.from('sessions').insert({ user_id: user.id, token })
  if (sessionError) throw sessionError

  const { password: _password, deleted_at: _deletedAt, ...safeUser } = user
  if (safeUser.account_type === 'student') {
    const { linked, parentDeleted } = await getLinkedParentStatus(user.id)
    safeUser.has_linked_parent = linked
    safeUser.linked_parent_deleted = parentDeleted
  }
  return { success: true, token, user: safeUser }
}

export default createPublicHandler({ method: 'POST', validate, handle })
