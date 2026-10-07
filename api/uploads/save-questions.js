import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { assertPremium } from '../_lib/subscription.js'

// Mirrors createUploadQuestions in storage.js. Also doubles as the endpoint
// behind cacheGeneratedUploadQuestions (questions generated on the fly from
// an upload's summary) and, via the optional pages_added field, the second
// half of addPagesToUpload (bumping uploads.pages_count/updated_at) — none
// of those three storage.js call sites need a table beyond upload_questions
// and uploads, so folding them into this one endpoint avoids inventing
// extra routes the spec didn't ask for. Ownership of upload_id is verified
// against the caller's session before writing anything.
function validate(body) {
  if (!body.upload_id || typeof body.upload_id !== 'string') return 'upload_id is required.'
  if (!Array.isArray(body.questions)) return 'questions must be an array.'
  return null
}

async function handle({ userId, body }) {
  await assertPremium(userId)
  const { upload_id: uploadId, questions, pages_added: pagesAdded } = body

  const { data: upload, error: uploadError } = await supabase
    .from('uploads')
    .select('id, user_id, pages_count')
    .eq('id', uploadId)
    .maybeSingle()
  if (uploadError) throw uploadError
  if (!upload || upload.user_id !== userId) {
    const err = new Error('Upload not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  if (questions.length > 0) {
    const rows = questions.map((q) => ({
      upload_id: uploadId,
      question: q.question,
      correct_answer: q.correct_answer,
      options: q.options,
      explanation: q.explanation,
      difficulty: q.difficulty,
    }))
    const { error } = await supabase.from('upload_questions').insert(rows)
    if (error) throw error
  }

  if (pagesAdded) {
    const { error } = await supabase
      .from('uploads')
      .update({ pages_count: (upload.pages_count || 0) + pagesAdded, updated_at: new Date().toISOString() })
      .eq('id', uploadId)
    if (error) throw error
  }

  return { savedCount: questions.length }
}

export default createStudentHandler({ method: 'POST', validate, handle })
