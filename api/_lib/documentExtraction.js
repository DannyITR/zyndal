// Reads an uploaded document (photos/PDFs) with Claude and returns
// { subject, topic, grade_level, document_type, questions, key_concepts,
// summary }. Used by api/generate-from-document.js for every upload.
//
// Pages are processed in batches of PAGES_PER_BATCH per Claude call, run in
// parallel, then merged. One call over a long upload has to fit every
// question into a single response, and once uploads stopped having a page
// cap that response could get cut off at max_tokens. Batching keeps each
// response a predictable size. generateJson still throws AI_RESPONSE_CUT_OFF
// if a single batch somehow runs past it.
import { generateJson } from './anthropic.js'

export const PAGES_PER_BATCH = 8
const MAX_TOKENS_PER_BATCH = 16000

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

// batch: { first, last, totalPages } (1-based page numbers) when the upload
// is split across several calls, else null.
function buildSystemPrompt(documentTypePhrase, pageCount, batch) {
  let pagesNote = ''
  if (batch) {
    pagesNote = ` These images are pages ${batch.first}-${batch.last} of a ${batch.totalPages}-page document; the other pages are being read separately. Treat the pages you have as one continuous section, in reading order, and cover only what is on them.`
  } else if (pageCount > 1) {
    pagesNote = ` The student has provided ${pageCount} pages/images that are all part of the same document — treat them as one continuous document, not separate documents, in reading order.`
  }

  return `You are an educational document scanner for Quebec high school students. The student has uploaded a ${documentTypePhrase}.${pagesNote} Read every page and return only JSON in this format:
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

"questions" must cover the material on these pages. There are two kinds of content, and a page can have both:

1. Questions printed on the page (a test, a worksheet, review questions): include every one of them. Don't repeat a question that appears on more than one page.

2. Material that teaches rather than asks (class notes, textbook pages, fill-in-the-blank handouts, including blanks the student has already filled in by hand): write the study questions yourself. Cover every fact, definition, date, name, place, cause and consequence on the page. Each filled-in blank becomes a question whose answer is what is written in that blank. There is no fixed number of questions: write as many as the material supports, and don't ask about the same fact twice.

Never return an empty "questions" array when the pages contain readable subject content.

If a question is not multiple-choice, leave "options" as an empty array and put the full answer in "correct_answer" — don't invent options for a printed question that has none.

Every question MUST have a non-empty "correct_answer" and "explanation". If the document already shows the correct answer (an answer key, a teacher's correction, worked notes, a filled-in blank), use it. If the question is unanswered on the page — a blank worksheet, a list of review questions — or the answer written on the page is wrong, work out the correct answer yourself, using the rest of the document first and your own subject knowledge where the document doesn't cover it. Never leave "correct_answer" blank.

Write questions, answers and explanations in the same language as the document.`
}

function toContentBlocks(files) {
  return files.map((file) =>
    file.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.base64 } }
      : { type: 'image', source: { type: 'base64', media_type: file.mediaType, data: file.base64 } }
  )
}

async function extractBatch(files, documentTypePhrase, batch) {
  return generateJson({
    system: buildSystemPrompt(documentTypePhrase, files.length, batch),
    schema: UPLOAD_DOCUMENT_SCHEMA,
    maxTokens: MAX_TOKENS_PER_BATCH,
    // Same pages should give the same result — at the default temperature
    // the same notes could come back with 50 questions one time and none
    // the next.
    temperature: 0,
    content: [...toContentBlocks(files), { type: 'text', text: 'Read these pages and return the JSON now.' }],
  })
}

// ---------- Merging batches ----------

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function wordSet(text) {
  return new Set(normalizeText(text).split(' ').filter(Boolean))
}

// Near-duplicate test for two questions from different batches: identical
// once case and punctuation are ignored, or sharing nearly all of their
// words (Jaccard >= 0.85) with the same answer. Short questions only match
// exactly, since a couple of shared words means little there.
const NEAR_DUPLICATE_THRESHOLD = 0.85
function isDuplicateQuestion(a, b) {
  if (normalizeText(a.question) === normalizeText(b.question)) return true
  const wordsA = a.words
  const wordsB = b.words
  if (wordsA.size < 4 || wordsB.size < 4) return false
  let shared = 0
  for (const w of wordsA) if (wordsB.has(w)) shared++
  const jaccard = shared / (wordsA.size + wordsB.size - shared)
  return jaccard >= NEAR_DUPLICATE_THRESHOLD && normalizeText(a.correct_answer) === normalizeText(b.correct_answer)
}

export function dedupeQuestions(questions) {
  const kept = []
  for (const q of questions) {
    if (!q || !q.question) continue
    const candidate = { ...q, words: wordSet(q.question) }
    if (!kept.some((k) => isDuplicateQuestion(k, candidate))) kept.push(candidate)
  }
  return kept.map(({ words: _words, ...q }) => q)
}

function dedupeStrings(values) {
  const seen = new Set()
  const out = []
  for (const value of values) {
    const key = normalizeText(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function mostCommon(values) {
  const counts = new Map()
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1)
  let best = values.find(Boolean)
  for (const [v, n] of counts) if (n > (counts.get(best) || 0)) best = v
  return best
}

const OVERVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { topic: { type: 'string' }, summary: { type: 'string' } },
  required: ['topic', 'summary'],
}

// Each batch summarized only its own pages, so a multi-batch upload gets
// one short text-only call to turn those into a single topic + 2-3 sentence
// summary for the whole document.
async function combineOverview(batchResults) {
  const sections = batchResults.map((r, i) => `Section ${i + 1} — topic: ${r.topic}\nSummary: ${r.summary}`).join('\n\n')
  return generateJson({
    system:
      'You combine section summaries of one student document into an overview. Return JSON with "topic" (a short title for the whole document) and "summary" (2-3 sentences covering all sections). Use the same language as the sections.',
    schema: OVERVIEW_SCHEMA,
    maxTokens: 1000,
    temperature: 0,
    content: sections,
  })
}

// files: [{ base64, mediaType }] — every page of one upload, in order.
// uploadType: 'test' | 'study_material' (only phrases the prompt).
export async function extractDocument({ files, uploadType }) {
  const documentTypePhrase = uploadType === 'test' ? 'test' : 'study material'

  if (files.length <= PAGES_PER_BATCH) {
    const result = await extractBatch(files, documentTypePhrase, null)
    return { ...result, questions: dedupeQuestions(result.questions || []) }
  }

  const batches = []
  for (let start = 0; start < files.length; start += PAGES_PER_BATCH) {
    const slice = files.slice(start, start + PAGES_PER_BATCH)
    batches.push({ files: slice, info: { first: start + 1, last: start + slice.length, totalPages: files.length } })
  }
  const results = await Promise.all(batches.map((b) => extractBatch(b.files, documentTypePhrase, b.info)))
  const overview = await combineOverview(results)

  return {
    subject: mostCommon(results.map((r) => r.subject)),
    topic: overview.topic,
    grade_level: mostCommon(results.map((r) => r.grade_level)),
    document_type: mostCommon(results.map((r) => r.document_type)),
    questions: dedupeQuestions(results.flatMap((r) => r.questions || [])),
    key_concepts: dedupeStrings(results.flatMap((r) => r.key_concepts || [])),
    summary: overview.summary,
  }
}
