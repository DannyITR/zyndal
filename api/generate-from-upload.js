import { createStudentHandler } from './_lib/studentHandler.js'
// Upload paths are no longer premium-gated (all features unlocked) —
// commented out, not deleted, so it can be re-enabled.
// import { assertPremium } from './_lib/subscription.js'
import { generateJson, QUESTION_SCHEMA, languageInstruction, gradeToSecondary } from './_lib/anthropic.js'

// Mirrors generateQuestionsFromUploadContent in src/lib/ai.js — used by
// questionSource.js's fallback chain for an upload that has a
// summary/key_concepts but no usable pre-extracted multiple-choice
// questions yet.
const UPLOAD_CONTENT_QUESTIONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: { type: 'array', items: QUESTION_SCHEMA },
  },
  required: ['questions'],
}

function buildSystemPrompt(summary, keyConcepts, subject, grade, language) {
  const secondary = gradeToSecondary(grade)
  const conceptsText = keyConcepts && keyConcepts.length > 0 ? keyConcepts.join(', ') : 'Not specified'
  return `You are a Quebec high school teacher. Based on the following uploaded study material, write multiple choice questions a student might face on a test. Cover every key concept and every important fact in the summary with at least one question. There is no fixed number of questions: write as many as the material supports, without repeating the same fact.

Material summary: ${summary}
Key concepts: ${conceptsText}
Subject: ${subject}
Grade: Secondary ${secondary}

Return only JSON:
{
  questions: [
    {
      question: string,
      options: [string, string, string, string],
      correct: number (0-3),
      explanation: string
    }
  ]
}

${languageInstruction(language)}`
}

function validate(body) {
  if (!body.subject || typeof body.subject !== 'string') return 'subject is required.'
  if (!Number.isFinite(body.grade)) return 'grade is required and must be a number.'
  if (!body.summary || typeof body.summary !== 'string') return 'summary is required.'
  if (body.key_concepts !== undefined && !Array.isArray(body.key_concepts)) return 'key_concepts must be an array if provided.'
  return null
}

// See generate-study-guide.js's identical comment for why this moved from
// createGenerateHandler (no auth) to createStudentHandler + assertPremium.
async function handle({ userId, body }) {
  // await assertPremium(userId)
  const { subject, grade, summary, key_concepts, language = 'English' } = body
  return generateJson({
    system: buildSystemPrompt(summary, key_concepts, subject, grade, language),
    schema: UPLOAD_CONTENT_QUESTIONS_SCHEMA,
    maxTokens: 8000,
    content: 'Generate the questions now.',
  })
}

export default createStudentHandler({ method: 'POST', validate, handle })
