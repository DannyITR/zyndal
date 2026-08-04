import { createStudentHandler } from './_lib/studentHandler.js'
import { assertPremium } from './_lib/subscription.js'
import { generateJson, QUESTION_SCHEMA, languageInstruction, gradeToSecondary } from './_lib/anthropic.js'

// Mirrors generateStudyGuide in src/lib/ai.js — the daily Study Guide
// feature's single set of 5 questions on one topic (distinct from Test
// Prep's multi-day plan, see generate-test-prep.js).
const STUDY_GUIDE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    topic: { type: 'string' },
    questions: { type: 'array', items: QUESTION_SCHEMA },
  },
  required: ['topic', 'questions'],
}

function buildSystemPrompt(grade, subject, language) {
  const secondary = gradeToSecondary(grade)
  return `You are a Quebec high school study planner. Generate a daily practice set for a Secondary ${secondary} student in ${subject}. Pick ONE specific topic from the Quebec Secondary ${secondary} ${subject} curriculum (vary your choice — don't always pick the most obvious topic) and write exactly 5 multiple-choice questions on it at mixed difficulty. Return only JSON: { topic: string, questions: [ { question: string, options: [string,string,string,string], correct: number (0-based index), explanation: string } ] }.\n\n${languageInstruction(language)}`
}

function validate(body) {
  if (!body.subject || typeof body.subject !== 'string') return 'subject is required.'
  if (!Number.isFinite(body.grade)) return 'grade is required and must be a number.'
  return null
}

// Was createGenerateHandler (no session auth at all — CORS + rate limit
// only) until this endpoint needed per-user premium enforcement, which
// requires knowing who's actually calling. That gap wasn't specific to
// premium status: with no auth, this endpoint (and its 3 siblings —
// generate-test-prep.js, generate-from-upload.js, generate-from-document.js)
// was callable by anyone on the internet, logged in or not, to burn
// Anthropic API credits. createStudentHandler's session check closes that
// entirely; assertPremium is the actual gate this task asked for. The
// IP-based rate limit createGenerateHandler used to apply is dropped here
// deliberately — every other session-authenticated endpoint in this
// codebase relies on auth as its defense rather than also rate-limiting by
// IP, and now that anonymous access is gone, that's the same posture.
async function handle({ userId, body }) {
  await assertPremium(userId)
  const { subject, grade, language = 'English' } = body
  return generateJson({
    system: buildSystemPrompt(grade, subject, language),
    schema: STUDY_GUIDE_SCHEMA,
    maxTokens: 16000,
    content: 'Generate the study guide now.',
  })
}

export default createStudentHandler({ method: 'POST', validate, handle })
