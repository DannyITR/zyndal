// Shared CORS handling for every API endpoint (via publicHandler.js,
// studentHandler.js, parentHandler.js, and handler.js). Only these origins
// are allowed to call the API — everything else gets no
// Access-Control-Allow-Origin header, which the browser then blocks.
//
// Both www.zyndal.ca and bare zyndal.ca are listed even though the apex
// redirects to www (see `vercel domains inspect zyndal.ca`) — the browser
// sends the Origin header of whichever host actually served the page
// making the request, so a stray direct fetch from the apex before the
// redirect completes would otherwise be blocked. zyndal.vercel.app is kept
// too (not just during the zyndal.ca migration — it's Vercel's permanent
// preview/production URL for this project, always reachable regardless of
// custom-domain DNS status).
const ALLOWED_ORIGINS = new Set([
  'https://zyndal.ca',
  'https://www.zyndal.ca',
  'https://zyndal.vercel.app',
  'http://localhost:5173',
])

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
