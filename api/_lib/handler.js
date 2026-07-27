import { applyCors } from './cors.js'
import { isRateLimited } from './rateLimit.js'

// Wraps a POST-only generate-* handler with CORS, method checking, rate
// limiting, and consistent error responses, so each /api/generate-* file
// only needs to supply its own request validation and generation logic.
export function createGenerateHandler({ validate, handle }) {
  return async function (req, res) {
    if (applyCors(req, res)) return

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed. Use POST.' })
      return
    }

    if (isRateLimited(req)) {
      res.status(429).json({ error: 'Too many requests. Please try again in a minute.' })
      return
    }

    try {
      // req.body is a lazy getter (Vercel's dev/prod runtime parses it on
      // first access) that THROWS on malformed JSON — reading it has to
      // happen inside this try, or a client sending a bad Content-Type:
      // application/json body with garbage bytes crashes the whole
      // function with an uncaught exception instead of getting a clean 400.
      const body = req.body || {}
      const validationError = validate(body)
      if (validationError) {
        res.status(400).json({ error: validationError })
        return
      }

      const result = await handle(body)
      res.status(200).json(result)
    } catch (err) {
      console.error('[api] generation failed:', err)
      res.status(err.refusal ? 422 : err.status || err.statusCode || 500).json({ error: err.message || 'Generation failed. Please try again.' })
    }
  }
}
