import crypto from 'crypto'

// Stateless admin session tokens — no admin_sessions table (this feature is
// SQL-free by design, and a single hardcoded admin identity doesn't need
// one). A token is `${expiresAtMs}.${signature}`, where signature is an
// HMAC-SHA256 of expiresAtMs keyed on ADMIN_PASSWORD itself: only the server
// (which already knows ADMIN_PASSWORD) can produce a signature that verifies,
// so the expiry can't be tampered with client-side, and every token is
// automatically invalidated the moment ADMIN_PASSWORD is rotated.
const SESSION_MS = 8 * 60 * 60 * 1000 // 8 hours

function sign(expiresAt) {
  const secret = process.env.ADMIN_PASSWORD
  if (!secret) throw new Error('ADMIN_PASSWORD is not configured.')
  return crypto.createHmac('sha256', secret).update(String(expiresAt)).digest('hex')
}

export function createAdminToken() {
  const expiresAt = Date.now() + SESSION_MS
  return { token: `${expiresAt}.${sign(expiresAt)}`, expiresAt }
}

export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [expiresAtStr, signature] = parts
  const expiresAt = Number(expiresAtStr)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false

  let expected
  try {
    expected = sign(expiresAt)
  } catch {
    return false
  }
  const actual = Buffer.from(signature)
  const wanted = Buffer.from(expected)
  if (actual.length !== wanted.length) return false
  return crypto.timingSafeEqual(actual, wanted)
}
