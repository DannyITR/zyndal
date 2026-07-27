import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'

// Backs createStudyPlan() in src/lib/storage.js.
function validate(body) {
  if (!body.subject || typeof body.subject !== 'string') return 'subject is required.'
  if (!body.topic || typeof body.topic !== 'string') return 'topic is required.'
  if (!body.test_date || typeof body.test_date !== 'string') return 'test_date is required.'
  if (!Number.isFinite(body.days_available) || body.days_available < 1) return 'days_available must be a positive number.'
  if (!body.plan_data || typeof body.plan_data !== 'object') return 'plan_data is required.'
  return null
}

async function handle({ userId, body }) {
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
