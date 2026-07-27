import { createGenerateHandler } from './_lib/handler.js'
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
  return `You are a Quebec high school teacher. Based on the following uploaded study material, generate 5 multiple choice questions a student might face on a test. Each question should test understanding of the key concepts in the material.

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

async function handle({ subject, grade, summary, key_concepts, language = 'English' }) {
  return generateJson({
    system: buildSystemPrompt(summary, key_concepts, subject, grade, language),
    schema: UPLOAD_CONTENT_QUESTIONS_SCHEMA,
    maxTokens: 8000,
    content: 'Generate the questions now.',
  })
}

export default createGenerateHandler({ validate, handle })
