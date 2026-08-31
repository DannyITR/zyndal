// Client-side API for the /admin panel — deliberately its own module, not
// part of storage.js. Uses a different localStorage key (ADMIN_SESSION_KEY)
// and a different header (X-Admin-Token, not X-Session-Token) than the
// regular student/parent session, and never imports anything from
// storage.js, so an admin token and a regular user session can never be
// confused with each other or leak into the wrong request.
const ADMIN_SESSION_KEY = 'zyndal_admin_session'

export function getAdminSession() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session?.token || !session?.expiresAt || Date.now() > session.expiresAt) {
      localStorage.removeItem(ADMIN_SESSION_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY)
}

function storeAdminSession(token, expiresAt) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ token, expiresAt }))
}

async function callAdminApi(method, endpoint, body) {
  const session = getAdminSession()
  let response
  try {
    response = await fetch(`/api/admin/${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { 'X-Admin-Token': session.token } : {}),
      },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    })
  } catch {
    throw new Error('Connection error — please try again.')
  }

  const data = await response.json().catch(() => null)

  if (response.status === 401) {
    clearAdminSession()
    throw new Error(data?.message || data?.error || 'Your admin session has expired. Please log in again.')
  }
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request to ${endpoint} failed (${response.status}).`)
  }
  return data
}

export async function adminLogin(password) {
  const { token, expiresAt } = await callAdminApi('POST', 'auth', { username: 'admin', password })
  storeAdminSession(token, expiresAt)
  return { token, expiresAt }
}

export function adminLogout() {
  clearAdminSession()
}

export function getAdminStats() {
  return callAdminApi('GET', 'get-stats')
}

export function getAdminUsers({ page = 1, limit = 50, search = '', accountType = '', isPremium = '', sortBy = '', sortDir = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search) params.set('search', search)
  if (accountType) params.set('account_type', accountType)
  if (isPremium !== '') params.set('is_premium', String(isPremium))
  if (sortBy) params.set('sort', sortBy)
  if (sortDir) params.set('sort_dir', sortDir)
  return callAdminApi('GET', `get-users?${params.toString()}`)
}

export function getAdminUserDetail(userId) {
  return callAdminApi('GET', `get-user-detail?user_id=${encodeURIComponent(userId)}`)
}

export function updateAdminUser(payload) {
  return callAdminApi('POST', 'update-user', payload)
}

export function deleteAdminUser(payload) {
  return callAdminApi('POST', 'delete-user', payload)
}

export function setAdminUserPassword(payload) {
  return callAdminApi('POST', 'set-user-password', payload)
}

export function adjustAdminXpCoins(payload) {
  return callAdminApi('POST', 'adjust-xp-coins', payload)
}

export function getAdminUploadQuestions(uploadId) {
  return callAdminApi('GET', `get-upload-questions?upload_id=${encodeURIComponent(uploadId)}`)
}

export function deleteAdminUpload(payload) {
  return callAdminApi('POST', 'delete-upload', payload)
}

export function deleteAdminGrade(payload) {
  return callAdminApi('POST', 'delete-grade', payload)
}

export function getAdminTeacherClaims() {
  return callAdminApi('GET', 'get-teacher-claims')
}

export function resolveAdminTeacherClaim(payload) {
  return callAdminApi('POST', 'resolve-teacher-claim', payload)
}
