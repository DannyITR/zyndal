import { createStudentHandler } from './_lib/studentHandler.js'
import { supabase } from './_lib/auth.js'
import { validateUploadIds, loadAccessibleUploads, countStudyGuideQuestions, getStudyGuideQuestions, generateMorePracticeQuestions } from './_lib/studyQuiz.js'

// The Study Guide's "From your uploaded materials" source: practice
// questions taken from the questions already saved on the student's uploads
// (the same pool as the printable quiz — see api/_lib/studyQuiz.js) rather
// than a freshly written set.
//
// action 'count' → { available }: how many questions those uploads have,
//   for the question-count picker. Never calls Claude.
// action 'start' → { questions }: `count` of them (10, 20, 30, or 'all'),
//   each as 4-option multiple choice. Claude is only called to write wrong
//   answers for saved short-answer questions (once — they're saved back),
//   or a set for an upload with no questions at all.
// action 'generate' → { added, available }: writes a fresh set of 4-option
//   practice questions from each upload's study guide summary and adds them
//   to its saved questions. The student's own uploads only — never writes
//   onto a classmate's shared notes.
//
// createStudentHandler runs requireAuth before handle(). Available to every
// user; not premium-gated.
const COUNT_CHOICES = [10, 20, 30, 'all']

function validate(body) {
  const idsError = validateUploadIds(body)
  if (idsError) return idsError
  if (!['count', 'start', 'generate'].includes(body.action)) return { field: 'action', message: "action must be 'count', 'start' or 'generate'." }
  if (body.action === 'start') {
    const count = body.count === 'all' ? 'all' : Number(body.count)
    if (!COUNT_CHOICES.includes(count)) return { field: 'count', message: 'count must be 10, 20, 30, or "all".' }
    body.count = count
  }
  return null
}

async function handle({ userId, body }) {
  const uploads = await loadAccessibleUploads(userId, body.upload_ids)
  if (body.action === 'count') return { available: await countStudyGuideQuestions({ uploads }) }

  if (body.action === 'generate' && uploads.some((u) => u.user_id !== userId)) {
    const err = new Error('Upload not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const { data: user, error } = await supabase.from('users').select('grade, language_preference').eq('id', userId).maybeSingle()
  if (error) throw error
  if (body.action === 'generate') {
    const added = await generateMorePracticeQuestions({ uploads, user })
    return { added, available: await countStudyGuideQuestions({ uploads }) }
  }
  return { questions: await getStudyGuideQuestions({ uploads, user, count: body.count }) }
}

export default createStudentHandler({ method: 'POST', validate, handle })
