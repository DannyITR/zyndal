// Server-only Claude client + the pieces every /api/generate-* function
// shares. ANTHROPIC_API_KEY has no VITE_ prefix on purpose — Vite only
// exposes VITE_-prefixed vars to the browser, so this name is what keeps
// the key out of the client bundle. This file is never imported by
// anything under src/.
import Anthropic from '@anthropic-ai/sdk'

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

// Runs a Claude call constrained to a JSON schema and returns the parsed
// result — shared by every generate-* endpoint so each one only supplies
// its own system prompt, schema, token budget, and message content.
export async function generateJson({ system, schema, maxTokens, content }) {
  const anthropic = getAnthropicClient()
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content }],
  })

  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') {
    const err = new Error('The request was declined by the model. Please try again.')
    err.refusal = true
    throw err
  }
  const text = message.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('No content was generated. Please try again.')
  return JSON.parse(text)
}
