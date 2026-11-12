import { createAdminHandler } from '../_lib/adminHandler.js'
import { supabase } from '../_lib/auth.js'

// Read-only Claude token usage for the admin panel's "AI usage" section,
// from api_usage_log (one row per Claude call — see api/_lib/usageLog.js).
// Grouping happens in Postgres (admin_api_usage_summary, see
// supabase/schema.sql) so a busy month doesn't mean pulling every row here.

// USD per million tokens. Estimates only: they ignore prompt-caching
// discounts and batch pricing, and must be updated by hand if Anthropic's
// prices change. Matched by model id prefix; a model not listed here is
// reported in unpricedModels instead of guessed at.
const PRICING = [{ prefix: 'claude-haiku-4-5', input: 1, output: 5 }]

function estimateCost(model, inputTokens, outputTokens) {
  const price = PRICING.find((p) => String(model).startsWith(p.prefix))
  if (!price) return null
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

const ALLOWED_DAYS = [7, 30, 90]

function validate(query) {
  if (query.days !== undefined && !ALLOWED_DAYS.includes(Number(query.days))) return `days must be one of ${ALLOWED_DAYS.join(', ')}.`
  return null
}

function addTo(map, key, row, cost) {
  const entry = map.get(key) || { key, calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 }
  entry.calls += row.calls
  entry.inputTokens += row.inputTokens
  entry.outputTokens += row.outputTokens
  entry.cost += cost || 0
  map.set(key, entry)
}

async function handle({ body }) {
  const days = Number(body.days) || 30
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - (days - 1))

  const { data, error } = await supabase.rpc('admin_api_usage_summary', { since: since.toISOString() })
  if (error) throw error

  const byFeature = new Map()
  const byDay = new Map()
  const unpricedModels = new Set()
  const totals = { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 }

  for (const raw of data || []) {
    const row = { calls: Number(raw.calls), inputTokens: Number(raw.input_tokens), outputTokens: Number(raw.output_tokens) }
    const cost = estimateCost(raw.model, row.inputTokens, row.outputTokens)
    if (cost === null) unpricedModels.add(raw.model)
    addTo(byFeature, raw.feature, row, cost)
    addTo(byDay, raw.day, row, cost)
    totals.calls += row.calls
    totals.inputTokens += row.inputTokens
    totals.outputTokens += row.outputTokens
    totals.cost += cost || 0
  }

  return {
    days,
    totals,
    byFeature: [...byFeature.values()].sort((a, b) => b.cost - a.cost),
    byDay: [...byDay.values()].sort((a, b) => (a.key < b.key ? 1 : -1)),
    unpricedModels: [...unpricedModels],
  }
}

export default createAdminHandler({ method: 'GET', validate, handle })
