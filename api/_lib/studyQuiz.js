// Printable quiz for an "upload package" (one or more of the student's own
// uploads), shared by api/generate-study-quiz.js (the preview) and
// api/email-study-quiz.js (the send).
//
// The quiz reuses the questions already saved on each selected upload
// (upload_questions — the same pool the Study Guide practice draws from),
// combined in upload order with duplicates removed, so it opens with no
// Claude call. Both the preview and the email read that same table, so they
// match. See getPackageQuiz.
//
// Only an upload with no saved questions at all gets a set generated, from
// its study guide summary (uploads.study_guide_summary: every concept on
// the upload with its facts, read from the original page images when
// they're stored, else built from its summary/key concepts/notes). That
// set is saved into upload_questions, so it's reused from then on.
//
// study_quizzes (one saved set per selection) is no longer written or
// read: the previous version generated a fresh set per selection and
// cached it there. The table is left in place.
import { supabase } from './auth.js'
import { generateJson, gradeToSecondary } from './anthropic.js'
import { sanitizeUuid } from './sanitize.js'
import { dedupeQuestions, PAGES_PER_BATCH } from './documentExtraction.js'
import { downloadSharedNoteFiles } from './sharedNotesStorage.js'
import { getForumMembership } from './forumAuth.js'

// Facts per quiz-generation call. Batching by fact count rather than by
// concept count, since one concept can carry 2 facts or 20: each fact
// becomes a question or two (~150-250 output tokens each), so ~30 facts
// keeps a response well under max_tokens while the batches run in
// parallel. The AI_RESPONSE_CUT_OFF error in generateJson remains the
// safety net.
const FACTS_PER_QUIZ_BATCH = 30
const MAX_TOKENS = 16000

function notFound() {
  const err = new Error('Upload not found.')
  err.status = 404
  err.code = 'NOT_FOUND'
  return err
}

function noContentError() {
  const err = new Error("These uploads don't have enough content to build a quiz from.")
  err.status = 422
  err.code = 'NO_QUIZ_CONTENT'
  return err
}

// Sorted and de-duplicated, so the same selection in any order maps to the
// same saved quiz.
export function normalizeUploadIds(ids) {
  return [...new Set(ids)].sort()
}

// Shared validate() step for both endpoints: upload_ids must be a non-empty
// array of ids, rewritten in place to its normalized (sorted, unique) form.
export function validateUploadIds(body) {
  if (!Array.isArray(body.upload_ids) || body.upload_ids.length === 0) return { field: 'upload_ids', message: 'upload_ids must be a non-empty array.' }
  const ids = body.upload_ids.map(sanitizeUuid)
  if (ids.some((id) => !id)) return { field: 'upload_ids', message: 'every upload id must be a valid id.' }
  body.upload_ids = normalizeUploadIds(ids)
  return null
}

// The requested non-deleted uploads, in the given order, that the caller
// may read: their own, or one shared to a class/group they belong to — the
// same rule get-upload-questions.js applies to viewing a shared upload, so
// a Notes Calendar day's quiz can include classmates' notes. A 404 if any
// id fails that, same "not found rather than forbidden" convention as
// save-questions.js. Membership is checked once per distinct class.
export async function loadAccessibleUploads(userId, uploadIds) {
  const { data, error } = await supabase
    .from('uploads')
    .select('id, user_id, subject, topic, notes, summary, key_concepts, document_type, created_at, updated_at, deleted_at, shared_class_type, shared_class_id, shared_files, study_guide_summary, study_guide_summary_source')
    .in('id', uploadIds)
  if (error) throw error
  const byId = new Map((data || []).map((u) => [u.id, u]))

  const membershipByClass = new Map()
  async function isMember(classType, classId) {
    const key = `${classType}:${classId}`
    if (!membershipByClass.has(key)) membershipByClass.set(key, getForumMembership(userId, classType, classId).then((m) => m.member))
    return membershipByClass.get(key)
  }

  return Promise.all(
    uploadIds.map(async (id) => {
      const upload = byId.get(id)
      if (!upload || upload.deleted_at) throw notFound()
      if (upload.user_id === userId) return upload
      if (upload.shared_class_id && (await isMember(upload.shared_class_type, upload.shared_class_id))) return upload
      throw notFound()
    })
  )
}

// ---------- Step 1: study guide summary, per upload ----------

const STUDY_GUIDE_SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    concepts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          facts: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'facts'],
      },
    },
  },
  required: ['concepts'],
}

const SUMMARY_INSTRUCTIONS = `Write a study guide summary of this material as a list of concepts. For each concept, list every fact a student should know about it: definitions, dates, names, places, numbers, causes and consequences. A filled-in blank on a handout is a fact (use what's written in the blank, corrected only if it is clearly wrong). Cover ALL of the material — don't skip a concept because it seems minor — and don't invent content that isn't there. Write in the same language as the material.`

async function summarizePages(files, batch) {
  const pagesNote = batch ? ` These are pages ${batch.first}-${batch.last} of a ${batch.totalPages}-page document; cover only these pages.` : ''
  const content = files.map((f) =>
    f.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.base64 } }
      : { type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.base64 } }
  )
  const { concepts } = await generateJson({
    system: `You are a Quebec high school teacher reading a student's uploaded study material.${pagesNote} ${SUMMARY_INSTRUCTIONS} Return only JSON: { concepts: [ { name: string, facts: [string] } ] }.`,
    schema: STUDY_GUIDE_SUMMARY_SCHEMA,
    maxTokens: MAX_TOKENS,
    content: [...content, { type: 'text', text: 'Write the study guide summary now.' }],
  })
  return concepts || []
}

async function summarizeFromText(upload) {
  const { data: saved, error } = await supabase.from('upload_questions').select('question, correct_answer').eq('upload_id', upload.id)
  if (error) throw error
  const qa = (saved || []).map((q) => `- ${q.question} → ${q.correct_answer || ''}`).join('\n')
  const source = [
    `Topic: ${upload.topic}`,
    upload.summary && `Summary: ${upload.summary}`,
    upload.key_concepts?.length && `Key concepts: ${upload.key_concepts.join(', ')}`,
    upload.notes && `Student's notes: ${upload.notes}`,
    qa && `Questions and answers found on the original pages:\n${qa}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  if (!upload.summary && !upload.key_concepts?.length && !qa) return []

  const { concepts } = await generateJson({
    system: `You are a Quebec high school teacher. The original pages of this upload aren't available; below is everything known about them. ${SUMMARY_INSTRUCTIONS} Return only JSON: { concepts: [ { name: string, facts: [string] } ] }.`,
    schema: STUDY_GUIDE_SUMMARY_SCHEMA,
    maxTokens: MAX_TOKENS,
    content: source,
  })
  return concepts || []
}

// Returns { concepts } for one upload, building and caching it first if
// it's missing or older than the upload's latest change.
export async function getOrBuildStudyGuideSummary(upload) {
  const fresh = upload.study_guide_summary && upload.study_guide_summary_source === upload.updated_at
  if (fresh) return upload.study_guide_summary

  let concepts
  if (Array.isArray(upload.shared_files) && upload.shared_files.length > 0) {
    const files = await downloadSharedNoteFiles(upload.shared_files)
    const batches = []
    for (let start = 0; start < files.length; start += PAGES_PER_BATCH) {
      const slice = files.slice(start, start + PAGES_PER_BATCH)
      batches.push(summarizePages(slice, files.length > PAGES_PER_BATCH ? { first: start + 1, last: start + slice.length, totalPages: files.length } : null))
    }
    concepts = (await Promise.all(batches)).flat()
  } else {
    concepts = await summarizeFromText(upload)
  }
  concepts = concepts.filter((c) => c && c.name)

  const summary = { concepts }
  if (concepts.length > 0) {
    const { error } = await supabase
      .from('uploads')
      .update({ study_guide_summary: summary, study_guide_summary_source: upload.updated_at })
      .eq('id', upload.id)
    if (error) throw error
  }
  return summary
}

// ---------- Step 2: the package's questions ----------

const QUIZ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correct_answer: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['question', 'options', 'correct_answer', 'explanation'],
      },
    },
  },
  required: ['questions'],
}

// Splits the package's concepts into batches of at most
// FACTS_PER_QUIZ_BATCH facts, keeping each concept whole where it fits and
// splitting one that alone exceeds the limit (each part keeps the name).
function chunkConceptsByFacts(concepts) {
  const chunks = []
  let current = []
  let size = 0
  const flush = () => {
    if (current.length) chunks.push(current)
    current = []
    size = 0
  }
  for (const concept of concepts) {
    const facts = concept.facts?.length ? concept.facts : [concept.name]
    for (let i = 0; i < facts.length; i += FACTS_PER_QUIZ_BATCH) {
      const part = facts.slice(i, i + FACTS_PER_QUIZ_BATCH)
      if (size + part.length > FACTS_PER_QUIZ_BATCH) flush()
      current.push({ name: concept.name, facts: part })
      size += part.length
    }
  }
  flush()
  return chunks
}

function renderConcepts(concepts) {
  return concepts.map((c) => `## ${c.name}\n${(c.facts || []).map((f) => `- ${f}`).join('\n')}`).join('\n\n')
}

function countFacts(concepts) {
  return concepts.reduce((sum, c) => sum + (c.facts?.length || 1), 0)
}

// The question count is tied to the facts given rather than fixed — one or
// two per fact — because an unanchored "write as many as needed" let a
// batch run away: 153 questions from 29 facts, drifting into open-ended
// essay questions and repeats until it hit max_tokens. Runs at the default
// temperature for the same reason (temperature 0 makes that kind of loop
// more likely); consistency comes from saving the result instead.
async function generateQuizBatch(concepts, { grade, language, part }) {
  const gradeLine = Number(grade) ? ` The student is in Secondary ${gradeToSecondary(Number(grade))}.` : ''
  const partNote = part ? ` This is part ${part.index} of ${part.total} of the study guide; other parts are handled separately, so cover only the concepts below.` : ''
  const facts = countFacts(concepts)
  const { questions } = await generateJson({
    system: `You are a Quebec high school teacher writing a printable paper quiz from a student's study guide summary.${gradeLine}${partNote}

Write questions that cover EVERY concept below and every fact listed under it — each fact must be tested by at least one question. Write one question per fact, or two when a fact has more than one thing worth testing — about ${facts} to ${facts * 2} questions for the ${facts} facts below. Only test facts that are listed; don't write open-ended essay or opinion questions, and don't test the same fact twice.

Mix question types:
- Multiple choice: exactly 4 options in "options", and "correct_answer" copied exactly from one of them.
- Short answer: "options" is an empty array, and "correct_answer" is a brief model answer a teacher would accept.

Every question needs a one-sentence "explanation" of why the answer is correct.

Write every question, option, answer, and explanation in ${language}, regardless of the language of the summary.`,
    schema: QUIZ_SCHEMA,
    maxTokens: MAX_TOKENS,
    content: renderConcepts(concepts),
  })
  return questions || []
}

// Safety net on top of generateJson's AI_RESPONSE_CUT_OFF: a batch that
// still runs out of tokens is split in half and each half retried, down to
// a single concept, before the error is allowed through.
async function generateQuizBatchWithRetry(concepts, options) {
  try {
    return await generateQuizBatch(concepts, options)
  } catch (err) {
    if (err.code !== 'AI_RESPONSE_CUT_OFF' || countFacts(concepts) <= 1) throw err
    let halves
    if (concepts.length > 1) {
      const mid = Math.ceil(concepts.length / 2)
      halves = [concepts.slice(0, mid), concepts.slice(mid)]
    } else {
      const [c] = concepts
      const mid = Math.ceil(c.facts.length / 2)
      halves = [[{ name: c.name, facts: c.facts.slice(0, mid) }], [{ name: c.name, facts: c.facts.slice(mid) }]]
    }
    console.warn(`[studyQuiz] quiz batch cut off at ${countFacts(concepts)} facts — retrying as two halves`)
    const results = await Promise.all(halves.map((half) => generateQuizBatchWithRetry(half, options)))
    return results.flat()
  }
}

// [{ question, options, answer, explanation }] — the shape buildStudyQuizHtml
// (src/lib/studyQuizWorksheet.js) takes. Drops a multiple-choice question
// whose answer isn't one of its options down to short answer, rather than
// printing a key that points at an option that isn't there.
function toWorksheetQuestions(rows) {
  return rows
    .filter((q) => q.question && q.correct_answer)
    .map((q) => ({
      question: q.question,
      options: Array.isArray(q.options) && q.options.includes(q.correct_answer) ? q.options : [],
      answer: q.correct_answer,
      explanation: q.explanation || '',
    }))
}

// uploads already in upload order (see getPackageQuiz), so "Notes 5-8 +
// Notes 11-13" reads the way the student took them, whatever order they
// were ticked in.
function packageTitle(uploads) {
  return uploads.map((u) => u.topic).join(' + ')
}

// The package's subject when every upload shares one, else null (the
// worksheet then just leaves the subject label out).
function packageSubject(uploads) {
  const subjects = new Set(uploads.map((u) => u.subject))
  return subjects.size === 1 ? uploads[0].subject : null
}

async function loadSavedQuestions(uploadId) {
  const { data, error } = await supabase
    .from('upload_questions')
    .select('question, correct_answer, options, explanation')
    .eq('upload_id', uploadId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

// Fallback for an upload with no saved questions at all: writes a full set
// from its study guide summary (batched by facts, see generateQuizBatch)
// and saves it into upload_questions, so the next printable quiz — and the
// Study Guide practice, which reads the same table — reuse it.
// For a classmate's shared upload (reachable from a Notes Calendar day)
// the set is saved onto that upload too: it's derived content, the same for
// everyone in the group, and saving it keeps the preview and the email in
// step. Shared uploads normally already have questions from when they were
// shared (see ensurePracticeQuestions in src/lib/ai.js).
async function generateAndSaveQuestions(upload, user) {
  const language = user?.language_preference || 'English'
  const { concepts } = await getOrBuildStudyGuideSummary(upload)
  if (!concepts?.length) return []

  const chunks = chunkConceptsByFacts(concepts)
  const batches = await Promise.all(
    chunks.map((chunk, i) => generateQuizBatchWithRetry(chunk, { grade: user?.grade, language, part: chunks.length > 1 ? { index: i + 1, total: chunks.length } : null }))
  )
  const rows = toWorksheetQuestions(dedupeQuestions(batches.flat())).map((q) => ({
    upload_id: upload.id,
    question: q.question,
    correct_answer: q.answer,
    options: q.options,
    explanation: q.explanation,
    difficulty: 'medium',
  }))
  if (rows.length === 0) return []

  // Two previews opened at once can both get here — whichever saved first
  // wins, and the other uses those rows instead of adding a second set.
  const raced = await loadSavedQuestions(upload.id)
  if (raced.length > 0) return raced

  const { error } = await supabase.from('upload_questions').insert(rows)
  if (error) throw error
  return loadSavedQuestions(upload.id)
}

// Returns { title, subject, questions } for the package. Reuses the
// questions already saved on each upload (upload_questions — the same
// pool the Study Guide practice draws from), so for any upload that has
// some, the preview needs no Claude call at all. Only an upload with none
// goes through generateAndSaveQuestions. Uploads are combined oldest first,
// in the order they were taken, with duplicates across them removed.
// uploads: from loadAccessibleUploads.
export async function getPackageQuiz({ uploads, user }) {
  const ordered = [...uploads].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  const perUpload = await Promise.all(
    ordered.map(async (upload) => {
      const saved = await loadSavedQuestions(upload.id)
      return saved.length > 0 ? saved : generateAndSaveQuestions(upload, user)
    })
  )
  const questions = toWorksheetQuestions(dedupeQuestions(perUpload.flat()))
  if (questions.length === 0) throw noContentError()

  return { title: packageTitle(ordered), subject: packageSubject(ordered), questions }
}
