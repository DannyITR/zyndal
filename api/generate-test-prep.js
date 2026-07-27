import { createGenerateHandler } from './_lib/handler.js'
import { generateJson, QUESTION_SCHEMA, languageInstruction, gradeToSecondary } from './_lib/anthropic.js'

// Mirrors generateStudyPlan in src/lib/ai.js — the Test Prep feature's
// multi-day plan building up to a specific test date.
const STUDY_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          day: { type: 'integer' },
          title: { type: 'string' },
          focus: { type: 'string' },
          lesson: { type: 'string' },
          questions: { type: 'array', items: QUESTION_SCHEMA },
        },
        required: ['day', 'title', 'focus', 'lesson', 'questions'],
      },
    },
  },
  required: ['days'],
}

function buildSystemPrompt(grade, subject, topic, days, language) {
  const secondary = gradeToSecondary(grade)
  return `You are a Quebec high school study planner. Generate a JSON study plan for a Secondary ${secondary} student preparing for a ${subject} test on ${topic} in ${days} days. Return only JSON with this structure: { days: [ { day: number, title: string, focus: string, lesson: string (2-3 paragraph mini lesson in simple language a teenager would understand), questions: [ { question: string, options: [string,string,string,string], correct: number, explanation: string } ] } ] }.

IMPORTANT DAY LOGIC:
- If X = 1 (test tomorrow or today) — return only 1 day with everything: full lesson + 10 questions covering all key concepts at mixed difficulty
- If X = 2 — return 2 days: day 1 concepts and easy/medium questions, day 2 hard questions and full review
- If X = 3 or more — spread across days with increasing difficulty: early days core concepts and easy questions, middle days medium practice, final day hard questions and review
- Generate 3-5 questions per day except when X=1 generate 10 questions
- Align to Quebec Secondary curriculum

Every question must have exactly 4 options, and "correct" is the 0-based index of the right option.

${languageInstruction(language)}`
}

function validate(body) {
  if (!body.subject || typeof body.subject !== 'string') return 'subject is required.'
  if (!Number.isFinite(body.grade)) return 'grade is required and must be a number.'
  if (!body.topic || typeof body.topic !== 'string') return 'topic is required.'
  if (!Number.isFinite(body.days_available) || body.days_available < 1) return 'days_available is required and must be a positive number.'
  return null
}

async function handle({ subject, grade, topic, days_available, language = 'English' }) {
  return generateJson({
    system: buildSystemPrompt(grade, subject, topic, days_available, language),
    schema: STUDY_PLAN_SCHEMA,
    maxTokens: 64000,
    content: 'Generate the study plan now.',
  })
}

export default createGenerateHandler({ validate, handle })
