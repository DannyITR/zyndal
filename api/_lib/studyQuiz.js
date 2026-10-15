// Shared by api/generate-study-quiz.js (the preview) and
// api/email-study-quiz.js (the send). Both resolve the quiz through
// getOrCreateQuizQuestions below, so the emailed worksheet is always built
// from the same saved upload_questions rows the student previewed.
import { supabase } from './auth.js'
import { generateJson, gradeToSecondary } from './anthropic.js'

// The caller's own, non-deleted upload, or a 404 — same "not found rather
// than forbidden" convention as save-questions.js, so probing someone
// else's upload id reveals nothing about whether it exists.
export async function loadOwnedUpload(userId, uploadId) {
  const { data: upload, error } = await supabase
    .from('uploads')
    .select('id, user_id, subject, topic, notes, summary, key_concepts, document_type, deleted_at')
    .eq('id', uploadId)
    .maybeSingle()
  if (error) throw error
  if (!upload || upload.user_id !== userId || upload.deleted_at) {
    const err = new Error('Upload not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  return upload
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

// options is empty for a short-answer question; correct_answer is then the
// written answer rather than one of the options.
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

function buildSystemPrompt(upload, grade, language) {
  const concepts = upload.key_concepts && upload.key_concepts.length > 0 ? upload.key_concepts.join(', ') : 'Not specified'
  const gradeLine = Number.isFinite(Number(grade)) && grade ? `Grade: Secondary ${gradeToSecondary(Number(grade))}` : ''
  return `You are a Quebec high school teacher writing a printable paper quiz from a student's own uploaded study material.

Topic: ${upload.topic}
Material summary: ${upload.summary || 'Not provided'}
Key concepts: ${concepts}
Student's own notes on this upload: ${upload.notes || 'None'}
${gradeLine}

Write as many questions as it takes to cover ALL of the material above — every key concept and every important fact in the summary should be tested by at least one question. Don't pad with repetitive questions, and don't stop early while something is still untested.

Mix question types:
- Multiple choice: exactly 4 options in "options", and "correct_answer" must be copied exactly from one of them.
- Short answer: "options" is an empty array, and "correct_answer" is a brief model answer a teacher would accept.

Every question needs a one-sentence "explanation" of why the answer is correct.

Write every question, option, answer, and explanation in ${language}, regardless of the language of the material.`
}

// Nothing to write a quiz from — a scan that produced no summary and no
// key concepts. Surfaced with its own code so the UI says so plainly.
function noContentError() {
  const err = new Error("This upload doesn't have enough content to build a quiz from.")
  err.status = 422
  err.code = 'NO_QUIZ_CONTENT'
  return err
}

// Returns the upload's saved questions, generating and saving a full set
// first if it has none yet — so whatever the preview showed is exactly what
// a later email (or another preview) loads.
export async function getOrCreateQuizQuestions(upload, user) {
  const saved = await loadSavedQuestions(upload.id)
  if (saved.length > 0) return saved

  if (!upload.summary && !(upload.key_concepts && upload.key_concepts.length > 0)) throw noContentError()

  const language = user.language_preference || 'English'
  const { questions } = await generateJson({
    system: buildSystemPrompt(upload, user.grade, language),
    schema: QUIZ_SCHEMA,
    maxTokens: 16000,
    content: 'Write the quiz now.',
  })

  const rows = (questions || [])
    .filter((q) => q.question && q.correct_answer)
    .map((q) => {
      // Drop malformed multiple-choice options rather than printing a key
      // that points at an option that isn't there.
      const options = Array.isArray(q.options) && q.options.includes(q.correct_answer) ? q.options : []
      return { upload_id: upload.id, question: q.question, correct_answer: q.correct_answer, options, explanation: q.explanation, difficulty: 'medium' }
    })
  if (rows.length === 0) throw noContentError()

  // Two previews opened at once can both reach this point — whichever
  // saves first wins, and the other returns those rows instead of adding a
  // second, different set.
  const raced = await loadSavedQuestions(upload.id)
  if (raced.length > 0) return raced

  const { error } = await supabase.from('upload_questions').insert(rows)
  if (error) throw error
  return loadSavedQuestions(upload.id)
}

// upload_questions rows -> the shape buildStudyQuizHtml takes.
export function toWorksheetQuestions(rows) {
  return rows.map((r) => ({
    question: r.question,
    options: Array.isArray(r.options) ? r.options : [],
    answer: r.correct_answer || '',
    explanation: r.explanation || '',
  }))
}
