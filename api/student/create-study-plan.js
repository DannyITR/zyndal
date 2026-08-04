import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { assertPremium } from '../_lib/subscription.js'
import { sanitizeSubject, sanitizeString, sanitizeGrade } from '../_lib/sanitize.js'

// Backs createStudyPlan() in src/lib/storage.js.
function validate(body) {
  const subject = sanitizeSubject(body.subject)
  if (!subject) return { field: 'subject', message: 'subject must be one of Math, Science, History, Geography, English, French.' }
  body.subject = subject

  const topic = sanitizeString(body.topic, 200)
  if (!topic) return { field: 'topic', message: 'topic is required and must be 1-200 characters.' }
  body.topic = topic

  if (!body.test_date || typeof body.test_date !== 'string') {
    return { field: 'test_date', message: 'test_date is required.' }
  }
  if (!Number.isFinite(body.days_available) || body.days_available < 1) {
    return { field: 'days_available', message: 'days_available must be a positive number.' }
  }
  if (!body.plan_data || typeof body.plan_data !== 'object') {
    return { field: 'plan_data', message: 'plan_data is required.' }
  }

  if (body.grade_level !== undefined && body.grade_level !== null && body.grade_level !== '') {
    const gradeLevel = sanitizeGrade(body.grade_level)
    if (gradeLevel === null) return { field: 'grade_level', message: 'grade_level must be 7, 8, 9, 10, or 11.' }
    body.grade_level = gradeLevel
  }

  return null
}

async function handle({ userId, body }) {
  await assertPremium(userId)
  const { subject, topic, test_date: testDate, days_available: daysAvailable, grade_level: gradeLevel, plan_data: planData } = body

  const { data, error } = await supabase
    .from('study_plans')
    .insert({ user_id: userId, subject, topic, test_date: testDate, days_available: daysAvailable, grade_level: gradeLevel ?? null, plan_data: planData })
    .select()
    .single()
  if (error) throw error
  return data
}

export default createStudentHandler({ method: 'POST', validate, handle })
