// Per-call Claude token accounting. Every generateJson call (see
// anthropic.js) writes one api_usage_log row from response.usage, so the
// admin panel's AI usage section (api/admin/get-ai-usage.js) can show where
// tokens actually go.
//
// The handler wrappers (studentHandler, teacherHandler, parentHandler,
// adminHandler, handler.js) run each request inside runWithUsageContext, so
// generateJson can attribute a call to the caller and the endpoint without
// every generate-* function threading userId through. A call can still name
// a more specific feature (e.g. 'upload-extract' vs 'upload-overview').
import { AsyncLocalStorage } from 'node:async_hooks'
import { supabase } from './auth.js'

const usageContext = new AsyncLocalStorage()

// req.url is e.g. '/api/generate-from-document?x=1' → 'generate-from-document'.
function featureFromUrl(url) {
  return (
    String(url || '')
      .split('?')[0]
      .replace(/^\/?api\//, '')
      .replace(/\.js$/, '') || 'unknown'
  )
}

export function runWithUsageContext(req, userId, fn) {
  return usageContext.run({ userId: userId || null, feature: featureFromUrl(req?.url) }, fn)
}

// Best-effort: a failed log write is reported but never fails the request
// that made the (already billed) call. Awaited by the caller so the write
// finishes before a serverless function can be frozen.
export async function logApiUsage({ feature, model, usage }) {
  if (!usage) return
  const ctx = usageContext.getStore() || {}
  const row = {
    user_id: ctx.userId || null,
    feature: feature || ctx.feature || 'unknown',
    model,
    input_tokens: (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0),
    output_tokens: usage.output_tokens || 0,
  }
  try {
    const { error } = await supabase.from('api_usage_log').insert(row)
    if (error) console.error('[usage] failed to log API usage:', error.message, row)
  } catch (err) {
    console.error('[usage] failed to log API usage:', err, row)
  }
}
