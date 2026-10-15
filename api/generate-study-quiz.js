import { createStudentHandler } from './_lib/studentHandler.js'
import { supabase } from './_lib/auth.js'
import { sanitizeUuid } from './_lib/sanitize.js'
import { loadOwnedUpload, getOrCreateQuizQuestions, toWorksheetQuestions } from './_lib/studyQuiz.js'
import { worksheetLangFor } from '../src/lib/studyQuizWorksheet.js'

// The Study Guide's "Printable quiz" preview: every question linked to one
// of the caller's own uploads, generating (and saving) a full set first if
// none exist yet — see api/_lib/studyQuiz.js. createStudentHandler runs
// requireAuth before handle(). Deliberately not premium-gated: available to
// every user.
//
// Returns data, not HTML — the client builds the worksheet with the same
// buildStudyQuizHtml that api/email-study-quiz.js uses, so the preview and
// the email come out identical.
function validate(body) {
  const uploadId = sanitizeUuid(body.upload_id)
  if (!uploadId) return { field: 'upload_id', message: 'upload_id must be a valid id.' }
  body.upload_id = uploadId
  return null
}

async function handle({ userId, body }) {
  const upload = await loadOwnedUpload(userId, body.upload_id)

  const { data: user, error } = await supabase.from('users').select('grade, language_preference').eq('id', userId).maybeSingle()
  if (error) throw error

  const rows = await getOrCreateQuizQuestions(upload, user || {})
  return {
    uploadId: upload.id,
    title: upload.topic,
    subject: upload.subject,
    lang: worksheetLangFor(user?.language_preference),
    questions: toWorksheetQuestions(rows),
  }
}

export default createStudentHandler({ method: 'POST', validate, handle })
