import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { insertNotification } from '../_lib/notifications.js'
import { sendPushToUser } from '../_lib/push.js'
import { sanitizeString, sanitizeSubject, sanitizeUuid } from '../_lib/sanitize.js'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

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
  // homework screen only ever reads these four.
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
        questions: body.questions,
      })
      .select()
      .single()
    if (insertError) throw insertError
    createdAssignments.push(assignment)

    const { data: enrollments, error: enrollError } = await supabase.from('class_students').select('student_id').eq('class_id', classRow.id)
    if (enrollError) throw enrollError

    const notifTitle = `📚 New homework assigned: ${body.title}`
    const notifBody = `Due ${body.due_date}`
    for (const enrollment of enrollments || []) {
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
    }
  }

  return { assignments: createdAssignments }
}

export default createTeacherHandler({ method: 'POST', validate, handle })
