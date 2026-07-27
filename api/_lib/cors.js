// Shared CORS handling for every /api/generate-* function. Only these two
// origins are allowed to call the API — the deployed app and the local dev
// server; everything else gets no Access-Control-Allow-Origin header, which
// the browser then blocks.
const ALLOWED_ORIGINS = new Set(['https://zyndal.vercel.app', 'http://localhost:5173'])

// Applies CORS headers and answers an OPTIONS preflight directly. Returns
// true if the caller should stop (preflight already answered), false to
// continue handling the real request.
export function applyCors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
