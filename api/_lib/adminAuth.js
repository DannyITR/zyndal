import crypto from 'crypto'

// Stateless admin session tokens — no admin_sessions table needed even now
// that each admin has a real users-table row (account_type = 'admin'): a
// token is `${adminId}.${expiresAtMs}.${signature}`, where signature is an
// HMAC-SHA256 of `${adminId}.${expiresAtMs}` keyed on ADMIN_PASSWORD itself
// — only the server (which already knows ADMIN_PASSWORD) can produce a
// signature that verifies, so neither the id nor the expiry can be
// tampered with client-side, and every token is automatically invalidated
// the moment ADMIN_PASSWORD is rotated. ADMIN_PASSWORD is still the one
// signing secret for every admin's token regardless of their own
// individual login password — it's a HMAC key, not a credential check
// (that's api/admin/auth.js's job now, against each admin's own bcrypt
// hash) — so it never needs to be exposed or compared again after login.
const SESSION_MS = 8 * 60 * 60 * 1000 // 8 hours

function sign(adminId, expiresAt) {
  const secret = process.env.ADMIN_PASSWORD
  if (!secret) throw new Error('ADMIN_PASSWORD is not configured.')
  return crypto.createHmac('sha256', secret).update(`${adminId}.${expiresAt}`).digest('hex')
}

export function createAdminToken(adminId) {
  const expiresAt = Date.now() + SESSION_MS
  return { token: `${adminId}.${expiresAt}.${sign(adminId, expiresAt)}`, expiresAt }
}

// Returns the admin's own user id on success, null on failure — was a
// plain boolean before per-admin identity existed; every caller
// (api/_lib/adminHandler.js) already treats a falsy return as "reject".
export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [adminId, expiresAtStr, signature] = parts
  const expiresAt = Number(expiresAtStr)
  if (!adminId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return null

  let expected
  try {
    expected = sign(adminId, expiresAt)
  } catch {
    return null
  }
  const actual = Buffer.from(signature)
  const wanted = Buffer.from(expected)
  if (actual.length !== wanted.length) return null
  return crypto.timingSafeEqual(actual, wanted) ? adminId : null
}
