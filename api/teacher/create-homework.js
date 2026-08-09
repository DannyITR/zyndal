import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { insertNotification } from '../_lib/notifications.js'
import { notificationText } from '../_lib/notificationText.js'
import { sendPushToUser } from '../_lib/push.js'
import { sendHomeworkAssignedEmail } from '../_lib/resend.js'
import { sanitizeString, sanitizeSubject, sanitizeUuid } from '../_lib/sanitize.js'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// Both question sources (the bank and AI-extraction-from-upload — see
// validate()'s own comment) store/generate the correct answer at a fixed
// position, which otherwise makes it the same position for every question
// in an assignment. Shuffled once here, at creation (in handle(), per
// class — see its own comment on why not once in validate() for all
// classes at once), rather than at fetch time (get-homework.js) or render
// time — every student in a given class then sees the same fixed layout
// (consistent for classroom discussion, "the answer to #3 is C"), and a
// page reload can't desync a question's rendered options from an
// in-progress attempt's selectedIndex the way re-shuffling on every fetch
// would. Grading (submit-homework.js) already compares selectedIndex
// against this stored `correct` field, so updating it to the post-shuffle
// position is the only change needed for grading to keep working.
function shuffleQuestionOptions(q) {
  const order = [0, 1, 2, 3]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return {
    ...q,
    options: order.map((originalIndex) => q.options[originalIndex]),
    correct: order.indexOf(q.correct),
  }
}

function validateQuestion(q, index) {
  if (!q || typeof q !== 'object') return `Question ${index + 1} is invalid.`
  if (!q.question || typeof q.question !== 'string') return `Question ${index + 1} is missing its text.`
  if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => typeof o !== 'string' || !o)) {
    return `Question ${index + 1} must have exactly 4 answer options.`
  }
  if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) {
    return `Question ${index + 1} must have a correct answer selected.`
  }
  return null
}

// Covers both tabs of the Assign Homework screen — a bank-sourced question
// row (id, subject, grade, unit_number, unit_title, topic_title, question,
// options, correct, explanation) and an AI-extracted-from-upload one
// (question, options, correct, explanation only, already converted
// client-side from the raw {question, correct_answer, options,
// explanation, difficulty} shape generate-from-document.js returns) both
// satisfy this same shape check.
function validate(body) {
  const title = sanitizeString(body.title, 100)
  if (!title) return { field: 'title', message: 'Title is required.' }
  body.title = title

  const subject = sanitizeSubject(body.subject)
  if (!subject) return { field: 'subject', message: 'A valid subject is required.' }
  body.subject = subject

  if (!body.due_date || typeof body.due_date !== 'string' || !DATE_PATTERN.test(body.due_date)) {
    return { field: 'due_date', message: 'due_date is required and must be in YYYY-MM-DD format.' }
  }

  if (!Array.isArray(body.class_ids) || body.class_ids.length === 0) {
    return { field: 'class_ids', message: 'Select at least one class.' }
  }
  const classIds = body.class_ids.map((id) => sanitizeUuid(id))
  if (classIds.some((id) => !id)) return { field: 'class_ids', message: 'One or more selected classes is invalid.' }
  body.class_ids = classIds

  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    return { field: 'questions', message: 'Add at least one question.' }
  }
  for (let i = 0; i < body.questions.length; i++) {
    const err = validateQuestion(body.questions[i], i)
    if (err) return { field: 'questions', message: err }
  }
  // Only the fields actually needed downstream — homework_submissions
  // scores by index into this exact array, and the student-facing
  // homework screen only ever reads these four. Option order is shuffled
  // per class in handle() below, not here — this array gets reused as-is
  // for every class_ids entry, and shuffling once here would give every
  // class the exact same layout instead of each its own.
  body.questions = body.questions.map((q) => ({
    question: q.question,
    options: q.options,
    correct: q.correct,
    explanation: q.explanation || null,
  }))

  return null
}

async function handle({ teacherId, body }) {
  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select('id, name')
    .in('id', body.class_ids)
    .eq('teacher_id', teacherId)
  if (classesError) throw classesError
  if (!classes || classes.length !== body.class_ids.length) {
    const err = new Error('One or more selected classes was not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const createdAssignments = []
  for (const classRow of classes) {
    const { data: assignment, error: insertError } = await supabase
      .from('homework_assignments')
      .insert({
        class_id: classRow.id,
        teacher_id: teacherId,
        title: body.title,
        subject: body.subject,
        due_date: body.due_date,
        questions: body.questions.map(shuffleQuestionOptions),
      })
      .select()
      .single()
    if (insertError) throw insertError
    createdAssignments.push(assignment)

    const { data: enrollments, error: enrollError } = await supabase.from('class_students').select('student_id').eq('class_id', classRow.id)
    if (enrollError) throw enrollError

    const studentIds = (enrollments || []).map((e) => e.student_id)
    const { data: enrolledStudents, error: studentsError } = studentIds.length
      ? await supabase.from('users').select('id, language_preference, email, email_verified').in('id', studentIds)
      : { data: [], error: null }
    if (studentsError) throw studentsError
    const studentById = Object.fromEntries((enrolledStudents || []).map((s) => [s.id, s]))

    for (const enrollment of enrollments || []) {
      const student = studentById[enrollment.student_id]
      const { title: notifTitle, body: notifBody } = notificationText('homework_assigned', student?.language_preference, {
        title: body.title,
        dueDate: body.due_date,
      })
      await insertNotification({
        userId: enrollment.student_id,
        type: 'homework_assigned',
        title: notifTitle,
        body: notifBody,
        data: { assignment_id: assignment.id, class_id: classRow.id },
      })
      await sendPushToUser({
        userId: enrollment.student_id,
        type: 'homework_assigned',
        title: notifTitle,
        body: notifBody,
        url: 'https://zyndal.ca',
      })

      // Best-effort, like every other side-channel notification here —
      // an email provider hiccup must never fail the assignment creation
      // itself. Only sent to students with a verified email on file (an
      // unverified address may not belong to them at all). Awaited rather
      // than fire-and-forget — a serverless function's event loop can
      // freeze right after the response is sent, same reasoning as the
      // verification-email send in update-settings.js.
      if (student?.email && student.email_verified) {
        try {
          await sendHomeworkAssignedEmail({
            email: student.email,
            title: body.title,
            className: classRow.name,
            dueDate: body.due_date,
            languagePreference: student.language_preference,
          })
        } catch (err) {
          console.error('[Homework] assignment email failed:', err)
        }
      }
    }
  }

  return { assignments: createdAssignments }
}

export default createTeacherHandler({ method: 'POST', validate, handle })
