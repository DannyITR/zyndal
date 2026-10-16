import { createStudentHandler } from './_lib/studentHandler.js'
import { supabase } from './_lib/auth.js'
import { sanitizeEmail } from './_lib/sanitize.js'
import { validateUploadIds, loadOwnedUploads, getOrCreatePackageQuiz } from './_lib/studyQuiz.js'
import { sendStudyQuizEmail } from './_lib/resend.js'
import { buildStudyQuizHtml, worksheetLangFor } from '../src/lib/studyQuizWorksheet.js'

// Emails the Study Guide's printable quiz, either to the caller's own
// account email (send_to: 'me') or to any address they type (send_to:
// 'other' + email). createStudentHandler runs requireAuth before handle().
// Not premium-gated: available to every user.
//
// The client sends only the upload ids — the worksheet is rebuilt here from
// the package's saved quiz (the same one the preview loaded via
// api/generate-study-quiz.js), never from client-supplied HTML, so this
// can't be used to mail arbitrary content from hello@zyndal.ca.
//
// Rate limit: 5 sends per user per rolling hour, counted in
// study_quiz_email_sends. That's shared storage rather than
// api/_lib/rateLimit.js's in-memory map, which resets per serverless
// instance and couldn't hold a per-hour limit.
const SEND_LIMIT = 5
const SEND_WINDOW_MS = 60 * 60 * 1000

function validate(body) {
  const idsError = validateUploadIds(body)
  if (idsError) return idsError

  if (body.send_to !== 'me' && body.send_to !== 'other') return { field: 'send_to', message: "send_to must be 'me' or 'other'." }
  if (body.send_to === 'other') {
    const email = sanitizeEmail(body.email)
    if (!email) return { field: 'email', message: 'Please enter a valid email address.' }
    body.email = email
  }
  return null
}

async function handle({ userId, body }) {
  const uploads = await loadOwnedUploads(userId, body.upload_ids)

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('username, email, grade, language_preference')
    .eq('id', userId)
    .maybeSingle()
  if (userError) throw userError

  const toSelf = body.send_to === 'me'
  const recipient = toSelf ? sanitizeEmail(user?.email) : body.email
  if (!recipient) {
    const err = new Error('No email address is on file for this account.')
    err.status = 400
    err.code = 'NO_EMAIL'
    throw err
  }

  // Logged first and counted after, so several sends fired at once can't
  // all pass the check before any of them is recorded. The row is removed
  // again if this send is rejected or fails, so only real sends use up one
  // of the student's five.
  const { data: logRow, error: logError } = await supabase
    .from('study_quiz_email_sends')
    .insert({ user_id: userId, upload_id: uploads[0].id, recipient })
    .select('id')
    .single()
  if (logError) throw logError
  const releaseSlot = () => supabase.from('study_quiz_email_sends').delete().eq('id', logRow.id)

  const windowStart = new Date(Date.now() - SEND_WINDOW_MS).toISOString()
  const { count, error: countError } = await supabase
    .from('study_quiz_email_sends')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart)
  if (countError) {
    await releaseSlot()
    throw countError
  }
  if ((count || 0) > SEND_LIMIT) {
    await releaseSlot()
    const err = new Error(`You can email up to ${SEND_LIMIT} quizzes per hour. Please try again later.`)
    err.status = 429
    err.code = 'STUDY_QUIZ_EMAIL_LIMIT'
    throw err
  }

  let html
  let quiz
  try {
    quiz = await getOrCreatePackageQuiz({ userId, uploads, user })
    html = buildStudyQuizHtml({
      title: quiz.title,
      subjectId: quiz.subject,
      questions: quiz.questions,
      lang: worksheetLangFor(user?.language_preference),
    })
  } catch (err) {
    await releaseSlot()
    throw err
  }

  try {
    await sendStudyQuizEmail({
      email: recipient,
      html,
      topic: quiz.title,
      senderUsername: user?.username,
      toSelf,
      languagePreference: user?.language_preference,
    })
  } catch (err) {
    await releaseSlot()
    console.error('[email-study-quiz] send failed:', err)
    const sendErr = new Error("We couldn't send that email. Please try again.")
    sendErr.status = 502
    sendErr.code = 'EMAIL_SEND_FAILED'
    throw sendErr
  }

  return { sentTo: recipient }
}

export default createStudentHandler({ method: 'POST', validate, handle })
