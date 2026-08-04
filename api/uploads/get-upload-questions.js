import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { assertPremium } from '../_lib/subscription.js'

// Two modes, both scoped to the caller's own uploads (never another user's,
// per spec):
//  - upload_id: returns { upload, questions } — backs getUploadDetail in
//    storage.js. The spec describes this endpoint as returning only
//    "questions", but every upload_id caller in the app also needs the
//    upload's own metadata (subject, topic, grade, timestamps) in the same
//    call, so it's included here rather than forcing a second round trip
//    to get-uploads.js just to find one row by id.
//  - subject: returns { uploads: [...] }, one entry per upload with its raw
//    question rows — storage.js reshapes this into BOTH
//    getUploadedContentForSubject's grouped/usable-questions shape and
//    getUploadedQuestions' topic-filtered flat shape, so this one query
//    covers both existing callers without the endpoint itself needing to
//    know which shape the caller ultimately wants.
function validate(body) {
  if (!body.upload_id && !body.subject) return 'upload_id or subject is required.'
  return null
}

async function handleByUploadId(userId, uploadId) {
  const { data: upload, error } = await supabase.from('uploads').select('*').eq('id', uploadId).maybeSingle()
  if (error) throw error
  if (!upload || upload.user_id !== userId) {
    const err = new Error('Upload not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  const { data: questions, error: questionsError } = await supabase
    .from('upload_questions')
    .select('*')
    .eq('upload_id', uploadId)
    .order('created_at', { ascending: true })
  if (questionsError) throw questionsError
  return { upload, questions: questions || [] }
}

async function handleBySubject(userId, subject) {
  const { data: uploads, error: uploadsError } = await supabase
    .from('uploads')
    .select('id, topic, summary, key_concepts')
    .eq('user_id', userId)
    .eq('subject', subject)
  if (uploadsError) throw uploadsError
  if (!uploads || uploads.length === 0) return { uploads: [] }

  const uploadIds = uploads.map((u) => u.id)
  const { data: questions, error: questionsError } = await supabase
    .from('upload_questions')
    .select('upload_id, question, correct_answer, options, explanation')
    .in('upload_id', uploadIds)
  if (questionsError) throw questionsError

  return {
    uploads: uploads.map((u) => ({
      uploadId: u.id,
      topic: u.topic,
      summary: u.summary,
      keyConcepts: u.key_concepts || [],
      questions: (questions || []).filter((q) => q.upload_id === u.id),
    })),
  }
}

async function handle({ userId, body }) {
  await assertPremium(userId)
  if (body.upload_id) return handleByUploadId(userId, body.upload_id)
  return handleBySubject(userId, body.subject)
}

export default createStudentHandler({ method: 'GET', validate, handle })
