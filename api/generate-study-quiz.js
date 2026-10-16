import { createStudentHandler } from './_lib/studentHandler.js'
import { supabase } from './_lib/auth.js'
import { validateUploadIds, loadOwnedUploads, getPackageQuiz } from './_lib/studyQuiz.js'
import { worksheetLangFor } from '../src/lib/studyQuizWorksheet.js'

// The Study Guide's "Printable quiz" preview for an upload package (one or
// more of the caller's own uploads): the questions already saved on those
// uploads, combined in upload order with duplicates removed — no Claude
// call unless an upload has none saved yet. See api/_lib/studyQuiz.js.
// createStudentHandler runs requireAuth before handle(). Deliberately not
// premium-gated: available to every user.
//
// Returns data, not HTML — the client builds the worksheet with the same
// buildStudyQuizHtml that api/email-study-quiz.js uses, so the preview and
// the email come out identical.
async function handle({ userId, body }) {
  const uploads = await loadOwnedUploads(userId, body.upload_ids)

  const { data: user, error } = await supabase.from('users').select('grade, language_preference').eq('id', userId).maybeSingle()
  if (error) throw error

  const quiz = await getPackageQuiz({ uploads, user })
  return {
    uploadIds: body.upload_ids,
    title: quiz.title,
    subject: quiz.subject,
    lang: worksheetLangFor(user?.language_preference),
    questions: quiz.questions,
  }
}

export default createStudentHandler({ method: 'POST', validate: validateUploadIds, handle })
