import { supabase } from '../_lib/auth.js'
import { generateJson, gradeToSecondary, languageInstruction } from '../_lib/anthropic.js'
import { SUBJECTS } from '../../src/lib/questions.js'

// language is the short DB code ('en'/'fr'/'es' — see generated_questions.
// language); LANGUAGE_NAME maps it to the full word languageInstruction()
// expects, matching every other AI-generation call site in this codebase.
const LANGUAGE_NAME = { en: 'English', fr: 'French', es: 'Spanish' }

// waitUntil promises share the invoking function's own timeout — this repo
// sets no maxDuration anywhere today, so without an explicit bump here the
// background generation triggered from resolveDailyQuestion could get
// silently killed mid-stream, and the pool would never populate. Needed
// here directly too since this endpoint can also be hit as a real
// synchronous POST, not just via waitUntil.
export const config = { maxDuration: 60 }

// Anthropic's structured-output JSON schema only supports array minItems/
// maxItems values of 0 or 1 (confirmed empirically: a 400 invalid_request_
// error for anything else, e.g. 4 or 20) — so exact counts (4 options per
// question, 20 questions per pool) can't be enforced via the schema itself.
// The system prompt asks for them explicitly instead, and the code below
// validates the actual counts after generation, throwing (caught by the
// waitUntil/HTTP caller either way) rather than silently saving a
// short/malformed pool that would then never re-trigger generation once
// the idempotency check's `>= 20` gate is (wrongly) satisfied.
const QUESTION_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    question: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    correct: { type: 'integer', description: '0-based index into options' },
    explanation: { type: 'string' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
  },
  required: ['question', 'options', 'correct', 'explanation', 'difficulty'],
}

const QUESTION_POOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: { type: 'array', items: QUESTION_ITEM_SCHEMA },
  },
  required: ['questions'],
}

function buildSystemPrompt({ subject, grade, unit_number, unit_title, topic_title, language }) {
  const secondary = gradeToSecondary(grade)
  const languageName = LANGUAGE_NAME[language] || 'English'
  return `You are a Quebec high school curriculum expert generating a permanent multiple-choice question bank for the Quebec Education Program (QEP). Generate EXACTLY 20 multiple choice questions (no more, no fewer) for Quebec Secondary ${secondary} students studying ${subject}, Unit ${unit_number}: ${unit_title}, Topic: ${topic_title}. Make questions varied in difficulty (a mix of easy, medium and hard). Each question must test a different aspect of the topic — no two questions should test the same fact or skill. Each question needs EXACTLY 4 options and a 0-based index for the correct one. Return the 20 questions in the "questions" array. ${languageInstruction(languageName)}`
}

// Exported separately from the default HTTP handler so
// resolveDailyQuestion (api/_lib/dailyQuestion.js) can call this in-process
// via waitUntil, with no HTTP round trip — mirrors generate-curriculum.js's
// generateCurriculumOutlineData split. Idempotent: skips generation
// entirely once 20 questions already exist for this exact combination, so
// it's safe to call repeatedly (e.g. once per student request that lands
// on a still-empty pool) without risking duplicate Claude calls or rows.
export async function generateQuestionPoolIfMissing({ subject, grade, unit_number, unit_title, topic_title, language = 'en' }) {
  const { count, error: countError } = await supabase
    .from('generated_questions')
    .select('id', { count: 'exact', head: true })
    .eq('subject', subject)
    .eq('grade', grade)
    .eq('unit_number', unit_number)
    .eq('topic_title', topic_title)
    .eq('language', language)
  if (countError) throw countError
  if ((count || 0) >= 20) return { generated: 0, skipped: true }

  // The model occasionally miscounts by one or two despite an explicit
  // "exactly 20" instruction (observed empirically) — retry once before
  // giving up, rather than either saving a wrong-sized pool (which would
  // never satisfy the >= 20 idempotency check above and keep re-generating
  // — and duplicating — content on every future trigger) or permanently
  // failing on a single bad count.
  let questions = null
  for (let attempt = 0; attempt < 2 && !questions; attempt++) {
    const result = await generateJson({
      system: buildSystemPrompt({ subject, grade, unit_number, unit_title, topic_title, language }),
      schema: QUESTION_POOL_SCHEMA,
      maxTokens: 64000,
      content: 'Generate the 20 questions now.',
    })
    const candidate = result.questions
    const validCount = Array.isArray(candidate) && candidate.length === 20
    const validOptions = validCount && !candidate.some((q) => !Array.isArray(q.options) || q.options.length !== 4)
    if (validCount && validOptions) questions = candidate
  }
  if (!questions) throw new Error('Could not generate a valid 20-question pool after retrying.')

  const rows = questions.map((q) => ({
    subject,
    grade,
    unit_number,
    unit_title,
    topic_title,
    question: q.question,
    options: q.options,
    correct: q.correct,
    explanation: q.explanation,
    difficulty: q.difficulty,
    language,
  }))

  const { error: insertError } = await supabase.from('generated_questions').insert(rows)
  if (insertError) throw insertError

  return { generated: rows.length, skipped: false }
}

function validate(body) {
  if (!body.subject || !SUBJECTS.some((s) => s.id === body.subject)) return 'subject is required and must be a valid subject id.'
  if (!Number.isFinite(Number(body.grade))) return 'grade is required and must be a number.'
  if (!Number.isFinite(Number(body.unit_number))) return 'unit_number is required and must be a number.'
  if (!body.unit_title || typeof body.unit_title !== 'string') return 'unit_title is required.'
  if (!body.topic_title || typeof body.topic_title !== 'string') return 'topic_title is required.'
  return null
}

// Not session-authenticated (createStudentHandler) — this is a system/cron
// endpoint. Validates Authorization: Bearer <CRON_SECRET>, matching
// Vercel's own documented convention for cron-invoked requests, so this
// works unmodified if a real vercel.json cron schedule is ever added later.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' })
    return
  }

  const expected = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || ''
  if (!expected || authHeader !== `Bearer ${expected}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    // req.body is a lazy getter that throws on malformed JSON — reading it
    // has to happen inside this try (see _lib/handler.js's identical note).
    const body = req.body || {}
    const validationError = validate(body)
    if (validationError) {
      res.status(400).json({ error: validationError })
      return
    }

    const result = await generateQuestionPoolIfMissing({
      subject: body.subject,
      grade: Number(body.grade),
      unit_number: Number(body.unit_number),
      unit_title: body.unit_title,
      topic_title: body.topic_title,
      language: LANGUAGE_NAME[body.language] ? body.language : 'en',
    })
    res.status(200).json(result)
  } catch (err) {
    console.error('[api] generate-question-pool failed:', err)
    res.status(err.refusal ? 422 : err.status || err.statusCode || 500).json({ error: err.message || 'Generation failed. Please try again.' })
  }
}
