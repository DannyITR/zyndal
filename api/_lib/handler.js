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

    const body = req.body || {}
    const validationError = validate(body)
    if (validationError) {
      res.status(400).json({ error: validationError })
      return
    }

    try {
      const result = await handle(body)
      res.status(200).json(result)
    } catch (err) {
      console.error('[api] generation failed:', err)
      res.status(err.refusal ? 422 : 500).json({ error: err.message || 'Generation failed. Please try again.' })
    }
  }
}
