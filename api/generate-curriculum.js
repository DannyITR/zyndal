import { createGenerateHandler } from './_lib/handler.js'
import { generateJson, gradeToSecondary } from './_lib/anthropic.js'

// Mirrors generateCurriculumOutline in src/lib/ai.js — generated at most
// once per subject+grade combination ever and shared globally from
// Supabase afterward (see getCurriculumOutline/saveCurriculumOutline in
// src/lib/storage.js), so real call volume here is tiny regardless of
// student count.
const CURRICULUM_TOPIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    topic_title: { type: 'string' },
    explanation: { type: 'string' },
    key_formulas: { type: 'array', items: { type: 'string' } },
    worked_example: { type: 'string' },
    common_mistakes: { type: 'string' },
  },
  required: ['topic_title', 'explanation', 'key_formulas', 'worked_example', 'common_mistakes'],
}

const CURRICULUM_UNIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    unit_number: { type: 'integer' },
    unit_title: { type: 'string' },
    topics: { type: 'array', items: CURRICULUM_TOPIC_SCHEMA },
  },
  required: ['unit_number', 'unit_title', 'topics'],
}

// Exported so translateCurriculumOutlineData (below) and the multilingual
// bulk-generation script can constrain a translation call to this exact
// shape too — additionalProperties:false + required already guarantees the
// model can't rename/drop/add keys during translation, which is most of
// why this is more robust than a raw "return only JSON" prompt.
export const CURRICULUM_OUTLINE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subject: { type: 'string' },
    grade: { type: 'integer' },
    units: { type: 'array', items: CURRICULUM_UNIT_SCHEMA },
  },
  required: ['subject', 'grade', 'units'],
}

function buildSystemPrompt(subject, grade) {
  const secondary = gradeToSecondary(grade)
  return `You are a Quebec high school curriculum expert. Generate a complete curriculum outline for ${subject} at the Secondary ${secondary} level following the Quebec Education Program (QEP). Return only JSON in this format:
{
  subject: string,
  grade: number,
  units: [
    {
      unit_number: number,
      unit_title: string,
      topics: [
        {
          topic_title: string,
          explanation: string (3-4 sentences explaining the concept in simple teen-friendly language),
          key_formulas: [string] (if applicable, empty array if not),
          worked_example: string (a step-by-step worked example showing how to solve a typical problem),
          common_mistakes: string (one sentence describing the most common mistake students make)
        }
      ]
    }
  ]
}`
}

function buildTranslationSystemPrompt(targetLanguage) {
  return `You are a professional translator specializing in Quebec Education Program (QEP) curriculum materials. Translate the given curriculum outline JSON from English to ${targetLanguage}. Translate only the text values (unit_title, topic_title, explanation, key_formulas, worked_example, common_mistakes) — never translate the "subject" field, and keep the JSON structure (same number of units, same number of topics per unit, same unit_number values) exactly as given. Keep mathematical notation, formulas, and numbers exactly as they appear in the source.`
}

function validate(body) {
  if (!body.subject || typeof body.subject !== 'string') return 'subject is required.'
  if (!Number.isFinite(body.grade)) return 'grade is required and must be a number.'
  return null
}

// Exported separately from the default HTTP handler so
// api/curriculum/get-outline.js can call the generation logic directly (an
// in-process function call) instead of round-tripping through this
// endpoint's own HTTP route, rate limit, and CORS layer.
export async function generateCurriculumOutlineData(subject, grade) {
  return generateJson({
    system: buildSystemPrompt(subject, grade),
    schema: CURRICULUM_OUTLINE_SCHEMA,
    maxTokens: 64000,
    content: 'Generate the curriculum outline now.',
  })
}

// Used by scripts/generate-multilingual-content.js and
// api/admin/generate-multilingual.js — targetLanguage is a full word
// ('French'/'Spanish'), matching languageInstruction's convention elsewhere
// in this codebase. Reuses CURRICULUM_OUTLINE_SCHEMA so the translated
// output is guaranteed the same shape as the English source (see that
// schema's own comment).
export async function translateCurriculumOutlineData(outlineData, targetLanguage) {
  return generateJson({
    system: buildTranslationSystemPrompt(targetLanguage),
    schema: CURRICULUM_OUTLINE_SCHEMA,
    maxTokens: 64000,
    content: JSON.stringify(outlineData),
  })
}

async function handle({ subject, grade }) {
  return generateCurriculumOutlineData(subject, grade)
}

export default createGenerateHandler({ validate, handle })
