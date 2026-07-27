import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getDailyQuestion, SUBJECTS } from '../../src/lib/questions.js'
import { todayStr } from '../../src/lib/streak.js'

// grade is accepted (per the request shape) but, matching current behavior
// exactly (StudentHome.jsx calls getDailyQuestion(subject.id) with no grade
// argument — the daily rotation isn't grade-filtered), it doesn't affect
// which question comes back. Not wired into any existing client call site:
// StudentHome.jsx already gets its question from the client-side bundled
// bank instantly with no round trip, and switching it to fetch here would
// be a larger change (see get-hardcoded-bank.js's note on why the answer
// key still ships to the client today).
function validate(body) {
  if (!body.subject || !SUBJECTS.some((s) => s.id === body.subject)) return 'subject is required and must be a valid subject id.'
  return null
}

async function handle({ userId, body }) {
  const { subject } = body
  const question = getDailyQuestion(subject)
  if (!question) {
    const err = new Error('Unknown subject.')
    err.status = 400
    err.code = 'VALIDATION_ERROR'
    throw err
  }

  const today = todayStr()
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
  }
}

export default createStudentHandler({ method: 'GET', validate, handle })
