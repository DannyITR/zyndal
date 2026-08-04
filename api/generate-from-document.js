import { createStudentHandler } from './_lib/studentHandler.js'
import { assertPremium } from './_lib/subscription.js'
import { generateJson } from './_lib/anthropic.js'

// Mirrors processUploadedDocument in src/lib/ai.js — NOT one of the four
// endpoints originally requested, but added to close the same gap: this is
// the last Claude call that was still using the browser-exposed key (photo/
// PDF uploads are scanned here). Leaving it out would defeat the point of
// this migration, since an attacker could still pull the key from this
// call path. See src/lib/imageUtils.js for the client-side resize/encode
// step this depends on.
//
// Caveat: Vercel's standard Node.js functions cap request bodies around
// 4.5MB. A photo is downscaled+JPEG-compressed client-side before it gets
// here, but a multi-page (up to 5) upload, or an uncompressed PDF up to the
// client's 15MB cap, can still exceed that — if so, Vercel rejects the
// request before this handler even runs. That's a real limit of this
// architecture, not something addressable inside the function itself.

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

function buildSystemPrompt(documentTypePhrase, pageCount) {
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

const MAX_PAGES = 5

function validate(body) {
  if (!body.uploadType || !['test', 'study_material'].includes(body.uploadType)) return 'uploadType must be "test" or "study_material".'
  if (!Array.isArray(body.files) || body.files.length === 0) return 'files must be a non-empty array.'
  if (body.files.length > MAX_PAGES) return `files cannot exceed ${MAX_PAGES} pages.`
  for (const file of body.files) {
    if (!file || typeof file.base64 !== 'string' || !file.base64) return 'each file must include base64 data.'
    if (!file.mediaType || typeof file.mediaType !== 'string') return 'each file must include a mediaType.'
  }
  return null
}

// See generate-study-guide.js's identical comment for why this moved from
// createGenerateHandler (no auth) to createStudentHandler + assertPremium
// — this one in particular used to mean anyone, logged in or not, could
// upload arbitrary images/PDFs and have them scanned on Zyndal's dime.
async function handle({ userId, body }) {
  await assertPremium(userId)
  const { uploadType, files } = body
  const documentBlocks = files.map((file) =>
    file.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.base64 } }
      : { type: 'image', source: { type: 'base64', media_type: file.mediaType, data: file.base64 } }
  )

  return generateJson({
    system: buildSystemPrompt(uploadType === 'test' ? 'test' : 'study material', files.length),
    schema: UPLOAD_DOCUMENT_SCHEMA,
    maxTokens: 12000,
    content: [...documentBlocks, { type: 'text', text: 'Extract everything from this document now.' }],
  })
}

export default createStudentHandler({ method: 'POST', validate, handle })
