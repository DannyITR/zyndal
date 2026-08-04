import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { assertPremium } from '../_lib/subscription.js'

// Backs updateStudyPlanData/completeStudyPlan/cancelStudyPlan in
// src/lib/storage.js behind one endpoint (same combined-action pattern as
// api/parent/update-settings.js and api/parent/resolve-bonus.js) — all three
// are the same "verify ownership, then patch one plan row" operation.
// plan_data is sent on nearly every first-attempt answer within a study
// plan (see StudyPlanScreen.jsx), so this stays a single lean ownership
// check + update rather than round-tripping through a full plan fetch.
function validate(body) {
  if (!body.plan_id || typeof body.plan_id !== 'string') return 'plan_id is required.'
  if (body.status !== undefined && body.status !== 'completed' && body.status !== 'cancelled') {
    return "status must be 'completed' or 'cancelled'."
  }
  if (body.plan_data !== undefined && (typeof body.plan_data !== 'object' || body.plan_data === null)) {
    return 'plan_data must be an object.'
  }
  if (body.plan_data === undefined && body.status === undefined) {
    return 'Provide plan_data and/or status to update.'
  }
  return null
}

async function handle({ userId, body }) {
  await assertPremium(userId)
  const { plan_id: planId, plan_data: planData, status } = body

  const { data: plan, error: fetchError } = await supabase.from('study_plans').select('user_id').eq('id', planId).maybeSingle()
  if (fetchError) throw fetchError
  if (!plan || plan.user_id !== userId) {
    const err = new Error('Study plan not found.')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }

  const updates = {}
  if (planData !== undefined) updates.plan_data = planData
  if (status !== undefined) updates.status = status

  const { data, error } = await supabase.from('study_plans').update(updates).eq('id', planId).select().single()
  if (error) throw error
  return data
}

export default createStudentHandler({ method: 'POST', validate, handle })
