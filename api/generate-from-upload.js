import { createStudentHandler } from './_lib/studentHandler.js'
// Upload paths are no longer premium-gated (all features unlocked) —
// commented out, not deleted, so it can be re-enabled.
// import { assertPremium } from './_lib/subscription.js'
import { generateJson, QUESTION_SCHEMA, languageInstruction, gradeToSecondary } from './_lib/anthropic.js'
import { withGenerationCache, hashKey } from './_lib/generationCache.js'

// The source here is only a 2-3 sentence summary plus key concepts, so a
// small set covers it. Was "as many as the material supports" with an 8k
// budget. ~200 tokens per question (see documentExtraction.js).
const MAX_QUESTIONS = 15
const MAX_TOKENS = 1000 + MAX_QUESTIONS * 200
const CACHE_VERSION = 'from-upload-v2'

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
  return `You are a Quebec high school teacher. Based on the following uploaded study material, write multiple choice questions a student might face on a test. Cover the key concepts and the important facts in the summary, without repeating the same fact. Write at most ${MAX_QUESTIONS} questions. Each explanation is ONE short sentence.

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
      explanation: string (one short sentence)
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
  // Cached per student on the exact inputs: resolveUploadQuestionPool in
  // questionSource.js asks again every practice session for an upload with
  // no usable questions, which used to mean a fresh Claude call each time
  // whenever the last one came back empty or failed to save.
  return withGenerationCache({
    userId,
    key: hashKey(CACHE_VERSION, subject, grade, summary, key_concepts || [], language),
    compute: async () => {
      const result = await generateJson({
        system: buildSystemPrompt(summary, key_concepts, subject, grade, language),
        schema: UPLOAD_CONTENT_QUESTIONS_SCHEMA,
        maxTokens: MAX_TOKENS,
        content: 'Generate the questions now.',
        feature: 'upload-questions-from-summary',
      })
      return { ...result, questions: (result.questions || []).slice(0, MAX_QUESTIONS) }
    },
  })
}

export default createStudentHandler({ method: 'POST', validate, handle })
