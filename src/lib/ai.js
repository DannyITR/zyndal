import { SUBJECTS, gradeToSecondary } from './questions'
import { buildDemoStudyPlanDays, buildDemoStudyGuide } from './testPrepQuestionBank'
import { fileToBase64, resizeImageToBase64 } from './imageUtils'

// ⚠️ TEMPORARY TESTING SWITCH — while true, generateStudyPlan and
// generateStudyGuide return hardcoded questions from testPrepQuestionBank.js
// instead of calling the Claude API. Set back to false (and nothing else
// needs to change) to restore live AI generation.
const DEMO_MODE = true

function resolveSubjectId(nameOrId) {
  const byId = SUBJECTS.find((s) => s.id === nameOrId)
  if (byId) return byId.id
  const byName = SUBJECTS.find((s) => s.name.toLowerCase() === String(nameOrId).toLowerCase())
  return byName ? byName.id : nameOrId
}

// Browser-side Claude client for the premium Test Prep feature. This is a
// prototype without a backend — dangerouslyAllowBrowser acknowledges that the
// key ships to the client, same trade-off already made for the Supabase keys.
// When a real backend exists, these calls move server-side unchanged.
// SDK is loaded on demand — most sessions never generate a plan, so it
// shouldn't bloat the initial bundle every user downloads.
async function getClient() {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Missing VITE_ANTHROPIC_API_KEY — add your Anthropic API key to .env and restart the dev server.')
  }
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

const MODEL = 'claude-haiku-4-5-20251001'

const QUESTION_SCHEMA = {
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

const STUDY_GUIDE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    topic: { type: 'string' },
    questions: { type: 'array', items: QUESTION_SCHEMA },
  },
  required: ['topic', 'questions'],
}

function buildStudyPlanSystemPrompt(grade, subject, topic, days) {
  const secondary = gradeToSecondary(grade)
  return `You are a Quebec high school study planner. Generate a JSON study plan for a Secondary ${secondary} student preparing for a ${subject} test on ${topic} in ${days} days. Return only JSON with this structure: { days: [ { day: number, title: string, focus: string, lesson: string (2-3 paragraph mini lesson in simple language a teenager would understand), questions: [ { question: string, options: [string,string,string,string], correct: number, explanation: string } ] } ] }.

IMPORTANT DAY LOGIC:
- If X = 1 (test tomorrow or today) — return only 1 day with everything: full lesson + 10 questions covering all key concepts at mixed difficulty
- If X = 2 — return 2 days: day 1 concepts and easy/medium questions, day 2 hard questions and full review
- If X = 3 or more — spread across days with increasing difficulty: early days core concepts and easy questions, middle days medium practice, final day hard questions and review
- Generate 3-5 questions per day except when X=1 generate 10 questions
- Align to Quebec Secondary curriculum

Every question must have exactly 4 options, and "correct" is the 0-based index of the right option.`
}

// Pure AI generation, curriculum-aligned only — the student's own uploaded
// questions (if they chose that source, or "mix") are merged in
// client-side afterward by questionSource.js, which keeps them verbatim
// instead of trusting the model not to paraphrase them.
export async function generateStudyPlan({ grade, subject, topic, daysAvailable }) {
  if (DEMO_MODE) {
    return buildDemoStudyPlanDays({ subjectId: resolveSubjectId(subject), grade, topic, daysAvailable })
  }

  const client = await getClient()

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    system: buildStudyPlanSystemPrompt(grade, subject, topic, daysAvailable),
    output_config: { format: { type: 'json_schema', schema: STUDY_PLAN_SCHEMA } },
    messages: [{ role: 'user', content: 'Generate the study plan now.' }],
  })

  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') {
    throw new Error('The study plan request was declined. Try rephrasing your topic.')
  }
  const text = message.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('No study plan was generated. Please try again.')
  return JSON.parse(text)
}

// Daily fallback study guide: 5 questions for the student's grade on a
// subject that rotates deterministically per day.
export function getTodaysGuideSubject(date = new Date()) {
  const daysSinceEpoch = Math.floor(date.getTime() / 86400000)
  return SUBJECTS[daysSinceEpoch % SUBJECTS.length]
}

export async function generateStudyGuide({ grade, subjectName }) {
  if (DEMO_MODE) {
    return buildDemoStudyGuide({ subjectId: resolveSubjectId(subjectName), grade })
  }

  const client = await getClient()
  const secondary = gradeToSecondary(grade)

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: `You are a Quebec high school study planner. Generate a daily practice set for a Secondary ${secondary} student in ${subjectName}. Pick ONE specific topic from the Quebec Secondary ${secondary} ${subjectName} curriculum (vary your choice — don't always pick the most obvious topic) and write exactly 5 multiple-choice questions on it at mixed difficulty. Return only JSON: { topic: string, questions: [ { question: string, options: [string,string,string,string], correct: number (0-based index), explanation: string } ] }.`,
    output_config: { format: { type: 'json_schema', schema: STUDY_GUIDE_SCHEMA } },
    messages: [{ role: 'user', content: 'Generate the study guide now.' }],
  })

  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') {
    throw new Error('The study guide request was declined. Please try again.')
  }
  const text = message.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('No study guide was generated. Please try again.')
  return JSON.parse(text)
}

// ---------- Questions generated from an upload's content ----------
// Not gated by DEMO_MODE — like processUploadedDocument, there's no
// meaningful hardcoded stand-in for "generate questions from THIS specific
// document's summary"; a demo-bank question would have nothing to do with
// what the student actually uploaded. Used by questionSource.js's fallback
// chain for an upload that has a summary/key_concepts but no (usable)
// pre-extracted multiple-choice questions — the result gets cached into
// upload_questions (see cacheGeneratedUploadQuestions in storage.js) so
// this only runs once per upload.

const UPLOAD_CONTENT_QUESTIONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: { type: 'array', items: QUESTION_SCHEMA },
  },
  required: ['questions'],
}

function buildUploadContentQuestionsPrompt(summary, keyConcepts, subjectName, grade) {
  const secondary = gradeToSecondary(grade)
  const conceptsText = keyConcepts && keyConcepts.length > 0 ? keyConcepts.join(', ') : 'Not specified'
  return `You are a Quebec high school teacher. Based on the following uploaded study material, generate 5 multiple choice questions a student might face on a test. Each question should test understanding of the key concepts in the material.

Material summary: ${summary}
Key concepts: ${conceptsText}
Subject: ${subjectName}
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
}`
}

export async function generateQuestionsFromUploadContent({ summary, keyConcepts, subject, grade }) {
  const client = await getClient()

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8000,
    system: buildUploadContentQuestionsPrompt(summary, keyConcepts, subject, grade),
    output_config: { format: { type: 'json_schema', schema: UPLOAD_CONTENT_QUESTIONS_SCHEMA } },
    messages: [{ role: 'user', content: 'Generate the questions now.' }],
  })

  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') {
    throw new Error('Could not generate questions from this material. Please try again.')
  }
  const text = message.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('No questions were generated from this material. Please try again.')
  return JSON.parse(text)
}

// ---------- Curriculum outlines ----------
// Not gated by DEMO_MODE — unlike study plans/guides (generated repeatedly,
// per student, per session), an outline is generated at most once per
// subject+grade combination ever and then shared by every student from
// Supabase forever (see getCurriculumOutline/saveCurriculumOutline in
// storage.js), so the real-world call volume is already tiny (≤18 calls:
// 6 subjects × 3 grades) regardless of how many students use the app.

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

const CURRICULUM_OUTLINE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subject: { type: 'string' },
    grade: { type: 'integer' },
    units: { type: 'array', items: CURRICULUM_UNIT_SCHEMA },
  },
  required: ['subject', 'grade', 'units'],
}

function buildCurriculumSystemPrompt(subjectName, grade) {
  const secondary = gradeToSecondary(grade)
  return `You are a Quebec high school curriculum expert. Generate a complete curriculum outline for ${subjectName} at the Secondary ${secondary} level following the Quebec Education Program (QEP). Return only JSON in this format:
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

export async function generateCurriculumOutline({ grade, subjectName }) {
  const client = await getClient()

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    system: buildCurriculumSystemPrompt(subjectName, grade),
    output_config: { format: { type: 'json_schema', schema: CURRICULUM_OUTLINE_SCHEMA } },
    messages: [{ role: 'user', content: 'Generate the curriculum outline now.' }],
  })

  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') {
    throw new Error('The curriculum outline request was declined. Please try again.')
  }
  const text = message.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('No curriculum outline was generated. Please try again.')
  return JSON.parse(text)
}

// ---------- Document upload scanner ----------
// Not gated by DEMO_MODE — there's no meaningful hardcoded stand-in for
// "read the content of this specific photo", so this always calls Claude.

const UPLOAD_QUESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    question: { type: 'string' },
    correct_answer: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
  },
  required: ['question', 'correct_answer', 'options', 'explanation', 'difficulty'],
}

const UPLOAD_DOCUMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subject: { type: 'string' },
    topic: { type: 'string' },
    grade_level: { type: 'string' },
    document_type: { type: 'string', enum: ['test', 'worksheet', 'textbook', 'notes'] },
    questions: { type: 'array', items: UPLOAD_QUESTION_SCHEMA },
    key_concepts: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['subject', 'topic', 'grade_level', 'document_type', 'questions', 'key_concepts', 'summary'],
}

function buildDocumentScanSystemPrompt(documentTypePhrase, pageCount) {
  const pagesNote =
    pageCount > 1
      ? ` The student has provided ${pageCount} pages/images that are all part of the same document — treat them as one continuous document, not separate documents. Extract all questions and information found across ALL provided pages combined into a single response, in reading order, and do not repeat a question that appears on more than one page.`
      : ''
  return `You are an educational document scanner for Quebec high school students. The student has uploaded a ${documentTypePhrase}.${pagesNote} Extract all questions and information from this document and return only JSON in this format:
{
  subject: string,
  topic: string,
  grade_level: string,
  document_type: 'test' | 'worksheet' | 'textbook' | 'notes',
  questions: [
    {
      question: string,
      correct_answer: string,
      options: [string, string, string, string],
      explanation: string,
      difficulty: 'easy' | 'medium' | 'hard'
    }
  ],
  key_concepts: [string],
  summary: string (2-3 sentences summarizing the material)
}

If a question in the source document is not already multiple-choice, leave "options" as an empty array and put the full answer in "correct_answer" — don't invent options that weren't in the document.`
}

// uploadType: 'test' | 'study_material' — only used to phrase the prompt
// ("a test" vs "a study material"); the model's own document_type
// classification (test/worksheet/textbook/notes) is what gets returned.
// files: 1-5 File objects (images and/or PDFs), all pages of one document,
// sent to Claude together in a single request so it can extract questions
// spanning multiple pages without duplication.
export async function processUploadedDocument({ files, uploadType }) {
  const client = await getClient()

  const documentBlocks = await Promise.all(
    files.map(async (file) => {
      const isPdf = file.type === 'application/pdf'
      const { base64, mediaType } = isPdf ? await fileToBase64(file) : await resizeImageToBase64(file)
      return isPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
        : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }
    })
  )

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 12000,
    system: buildDocumentScanSystemPrompt(uploadType === 'test' ? 'test' : 'study material', files.length),
    output_config: { format: { type: 'json_schema', schema: UPLOAD_DOCUMENT_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [...documentBlocks, { type: 'text', text: 'Extract everything from this document now.' }],
      },
    ],
  })

  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') {
    throw new Error('This document could not be processed. Please try a clearer photo.')
  }
  const text = message.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('No information could be extracted. Please try again.')
  return JSON.parse(text)
}
