import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { resolveDailyQuestion } from '../_lib/dailyQuestion.js'
import { SUBJECTS } from '../../src/lib/questions.js'
import { todayStr, isValidTimeZone, DEFAULT_TIMEZONE } from '../../src/lib/streak.js'

// The real, authoritative daily-question endpoint — StudentHome.jsx fetches
// from here instead of computing the question purely client-side, since
// resolveDailyQuestion's selection (a generated-pool hash pick, or a
// grade-filtered hardcoded fallback) depends on server-side state
// (generated_questions, the student's own grade, this month's answered
// questions) the client has no direct access to. submit-answer.js calls the
// same resolver to stay the scoring authority, so both always agree on
// exactly which question "today's" is for a given student+subject.
function validate(body) {
  if (!body.subject || !SUBJECTS.some((s) => s.id === body.subject)) return 'subject is required and must be a valid subject id.'
  return null
}

async function handle({ userId, body }) {
  const { subject } = body
  const timezone = isValidTimeZone(body.timezone) ? body.timezone : DEFAULT_TIMEZONE

  const question = await resolveDailyQuestion({ userId, subject, timezone })

  const today = todayStr(new Date(), timezone)
  const { data: existing, error } = await supabase
    .from('answers')
    .select('id')
    .eq('user_id', userId)
    .eq('subject', subject)
    .gte('answered_at', `${today}T00:00:00.000Z`)
    .lte('answered_at', `${today}T23:59:59.999Z`)
    .maybeSingle()
  if (error) throw error

  return {
    question: question.prompt,
    options: question.options,
    correct: question.correctIndex,
    already_answered: Boolean(existing),
    subject,
    grade: question.grade,
    unit_number: question.unitNumber ?? null,
    unit_title: question.unitTitle ?? null,
    topic_title: question.topicTitle ?? null,
    topic: question.topic ?? null,
    source: question.source,
    explanation: question.explanation ?? null,
  }
}

export default createStudentHandler({ method: 'GET', validate, handle })
