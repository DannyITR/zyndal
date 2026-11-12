// Server-only Claude client + the pieces every /api/generate-* function
// shares. ANTHROPIC_API_KEY has no VITE_ prefix on purpose — Vite only
// exposes VITE_-prefixed vars to the browser, so this name is what keeps
// the key out of the client bundle. This file is never imported by
// anything under src/.
import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from './usageLog.js'

export const MODEL = 'claude-haiku-4-5-20251001'

let client = null
export function getAnthropicClient() {
  if (client) return client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY environment variable.')
  client = new Anthropic({ apiKey })
  return client
}

// Quebec's Secondary school system (Secondary 1-5) maps to this app's
// internal grade field (7-11) — kept in sync by hand with
// gradeToSecondary in src/lib/questions.js, since this file intentionally
// has no imports from src/ (serverless functions bundle independently).
export function gradeToSecondary(grade) {
  return grade - 6
}

export const QUESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    question: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    correct: { type: 'integer', description: '0-based index into options' },
    explanation: { type: 'string' },
  },
  required: ['question', 'options', 'correct', 'explanation'],
}

export function languageInstruction(language) {
  return `Generate all questions, options, explanations and content in ${language}. Match the language of the source material exactly.`
}

// Out of credits, a billing problem, or a bad/revoked key: nothing the
// student can fix, so they get a generic "temporarily unavailable" message
// (errors.AI_UNAVAILABLE) while the real error goes to the server log.
// Running out of credit comes back as a 400 invalid_request_error whose
// message mentions the credit balance, not as its own status.
function isAccountLevelError(err) {
  if (!(err instanceof Anthropic.APIError)) return false
  const type = err.error?.error?.type || err.error?.type
  if (type === 'billing_error' || type === 'authentication_error' || type === 'permission_error') return true
  if (err.status === 401 || err.status === 402 || err.status === 403) return true
  return /credit balance|billing|purchase credits/i.test(err.message || '')
}

function aiUnavailableError() {
  const err = new Error('AI features are temporarily unavailable, please try again later.')
  err.status = 503
  err.code = 'AI_UNAVAILABLE'
  return err
}

// Runs a Claude call constrained to a JSON schema and returns the parsed
// result — shared by every generate-* endpoint so each one only supplies
// its own system prompt, schema, token budget, and message content.
// temperature is optional; omitted, the API default applies. feature is
// the optional api_usage_log label for this call, defaulting to the
// endpoint name (see usageLog.js).
export async function generateJson({ system, schema, maxTokens, content, temperature, feature }) {
  const anthropic = getAnthropicClient()
  let message
  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      ...(temperature !== undefined ? { temperature } : {}),
      system,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content }],
    })
    message = await stream.finalMessage()
  } catch (err) {
    if (isAccountLevelError(err)) {
      console.error(`[anthropic] account-level error (status=${err.status}, feature=${feature || 'default'}):`, err.message, err.error)
      throw aiUnavailableError()
    }
    throw err
  }

  // Logged before the checks below: a refused or cut-off response is still
  // billed.
  await logApiUsage({ feature, model: message.model || MODEL, usage: message.usage })

  if (message.stop_reason === 'refusal') {
    const err = new Error('The request was declined by the model. Please try again.')
    err.refusal = true
    throw err
  }
  // A response that hit max_tokens is truncated JSON — say so plainly
  // instead of letting JSON.parse fail with a confusing syntax error.
  if (message.stop_reason === 'max_tokens') {
    console.error(`[anthropic] response cut off at max_tokens=${maxTokens} (output_tokens=${message.usage?.output_tokens}, feature=${feature || 'default'})`)
    const err = new Error('The AI response was cut off before it finished. Please try again.')
    err.status = 502
    err.code = 'AI_RESPONSE_CUT_OFF'
    throw err
  }
  const text = message.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('No content was generated. Please try again.')
  return JSON.parse(text)
}
