// Stops the same input from being sent to Claude twice. Keyed per user on
// a hash of the exact request (the encoded page images, or an upload's
// summary), so a double tap, a second tab, a client retry after a dropped
// response, or a practice session re-asking for an upload that already
// came back empty all reuse one result instead of paying for another call.
//
// A row is 'pending' while the first request is still running. A matching
// request that arrives then gets GENERATION_IN_PROGRESS rather than
// starting a second identical call; the unique (user_id, cache_key) index
// makes that hold across serverless instances. A pending row older than
// PENDING_STALE_MS is treated as abandoned (the function was killed) and
// replaced.
import { createHash } from 'node:crypto'
import { supabase } from './auth.js'

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000
const PENDING_STALE_MS = 5 * 60 * 1000

export function hashKey(...parts) {
  const hash = createHash('sha256')
  for (const part of parts) hash.update(typeof part === 'string' ? part : JSON.stringify(part)).update('\u0000')
  return hash.digest('hex')
}

function inProgressError() {
  const err = new Error('This upload is already being processed. Please wait a moment.')
  err.status = 409
  err.code = 'GENERATION_IN_PROGRESS'
  return err
}

// compute() runs only when there's no usable row; its result is stored and
// returned. Any failure clears the pending row so a retry can run.
export async function withGenerationCache({ userId, key, ttlMs = DEFAULT_TTL_MS, compute }) {
  if (!userId) return compute()

  const { data: existing, error: readError } = await supabase
    .from('ai_generation_cache')
    .select('id, status, result, created_at')
    .eq('user_id', userId)
    .eq('cache_key', key)
    .maybeSingle()
  if (readError) throw readError

  if (existing) {
    const age = Date.now() - new Date(existing.created_at).getTime()
    if (existing.status === 'done' && age < ttlMs) return existing.result
    if (existing.status === 'pending' && age < PENDING_STALE_MS) throw inProgressError()
    await supabase.from('ai_generation_cache').delete().eq('id', existing.id)
  }

  const { data: claimed, error: claimError } = await supabase
    .from('ai_generation_cache')
    .insert({ user_id: userId, cache_key: key, status: 'pending' })
    .select('id')
    .single()
  if (claimError) {
    // 23505: another request claimed this key between our read and insert.
    if (claimError.code === '23505') throw inProgressError()
    throw claimError
  }

  let result
  try {
    result = await compute()
  } catch (err) {
    await supabase.from('ai_generation_cache').delete().eq('id', claimed.id)
    throw err
  }

  const { error: saveError } = await supabase
    .from('ai_generation_cache')
    .update({ status: 'done', result, created_at: new Date().toISOString() })
    .eq('id', claimed.id)
  if (saveError) console.error('[generationCache] failed to save result:', saveError.message)
  return result
}
