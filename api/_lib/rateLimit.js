// Best-effort, in-memory per-IP rate limit. This resets whenever a
// serverless instance cold-starts and is only enforced per warm instance —
// Vercel can run several concurrent instances of the same function, so a
// determined client could exceed this by landing on different instances.
// Good enough to blunt a single misbehaving client hammering one instance;
// a real distributed limit needs shared storage (e.g. Upstash Redis), which
// isn't set up in this project.
const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 20

const hitsByIp = new Map() // ip -> timestamps (ms) of recent requests

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress || 'unknown'
}

// Records this request and returns true if the caller is over the limit.
export function isRateLimited(req) {
  const ip = clientIp(req)
  const now = Date.now()
  const recent = (hitsByIp.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hitsByIp.set(ip, recent)
  return recent.length > MAX_REQUESTS_PER_WINDOW
}
