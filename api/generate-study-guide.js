import { createGenerateHandler } from './_lib/handler.js'
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

async function handle({ subject, grade, language = 'English' }) {
  return generateJson({
    system: buildSystemPrompt(grade, subject, language),
    schema: STUDY_GUIDE_SCHEMA,
    maxTokens: 16000,
    content: 'Generate the study guide now.',
  })
}

export default createGenerateHandler({ validate, handle })
