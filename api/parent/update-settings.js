import { createParentHandler } from '../_lib/parentHandler.js'
import { supabase } from '../_lib/auth.js'
import { verifyStudentBelongsToParent, getParentWalletRow, walletRowToJson } from '../_lib/parentDb.js'
import { sanitizeUuid, sanitizeInteger } from '../_lib/sanitize.js'

// Mirrors FOUR separate storage.js functions (updateCoinRate,
// updateMilestoneSettings, updatePerfectWeekBonus, updateGradeRewardSettings)
// behind one endpoint, as spec'd. Two of those settings live on the parent's
// own `users` row (coin_rate, milestone_settings — no student_id needed);
// the other two live on a specific (parent, student) row in parent_student
// (perfect_week_bonus, grade_thresholds), so student_id is required for
// those and is checked against verifyStudentBelongsToParent. The literal
// spec's body shape omits student_id and milestone_settings entirely — both
// are added here since parent_student is inherently per-student, and
// milestone_settings has no other endpoint that could ever update it.
function validate(body) {
  const hasStudentField = body.perfect_week_bonus !== undefined || body.grade_thresholds !== undefined
  if (hasStudentField) {
    const studentId = sanitizeUuid(body.student_id)
    if (!studentId) {
      return { field: 'student_id', message: 'student_id must be a valid UUID when updating perfect_week_bonus or grade_thresholds.' }
    }
    body.student_id = studentId
  }

  if (body.coin_rate !== undefined) {
    const coinRate = sanitizeInteger(body.coin_rate, 1, 1000)
    if (coinRate === null) {
      return { field: 'coin_rate', message: 'coin_rate must be a whole number between 1 and 1000.' }
    }
    body.coin_rate = coinRate
  }

  if (body.perfect_week_bonus !== undefined) {
    if (!Number.isFinite(body.perfect_week_bonus) || body.perfect_week_bonus < 0 || body.perfect_week_bonus > 10000) {
      return { field: 'perfect_week_bonus', message: 'perfect_week_bonus must be a number between 0 and 10000.' }
    }
  }

  if (body.grade_thresholds !== undefined) {
    const gt = body.grade_thresholds || {}
    const aPlusCents = sanitizeInteger(gt.aPlusCents, 0, 1000000)
    const aCents = sanitizeInteger(gt.aCents, 0, 1000000)
    const bCents = sanitizeInteger(gt.bCents, 0, 1000000)
    const cCents = sanitizeInteger(gt.cCents, 0, 1000000)
    if ([aPlusCents, aCents, bCents, cCents].some((v) => v === null)) {
      return { field: 'grade_thresholds', message: 'grade_thresholds must include whole-number aPlusCents, aCents, bCents, cCents between 0 and 1000000.' }
    }
    body.grade_thresholds = { aPlusCents, aCents, bCents, cCents }
  }

  if (body.milestone_settings !== undefined && (typeof body.milestone_settings !== 'object' || body.milestone_settings === null)) {
    return { field: 'milestone_settings', message: 'milestone_settings must be an object.' }
  }

  if (
    body.coin_rate === undefined &&
    body.perfect_week_bonus === undefined &&
    body.grade_thresholds === undefined &&
    body.milestone_settings === undefined
  ) {
    return { field: 'body', message: 'Provide at least one setting to update.' }
  }
  return null
}

async function handle({ parentId, body }) {
  const result = {}

  if (body.coin_rate !== undefined || body.milestone_settings !== undefined) {
    const updates = {}
    if (body.coin_rate !== undefined) updates.coin_to_dollar_rate = body.coin_rate
    if (body.milestone_settings !== undefined) updates.milestone_settings = body.milestone_settings
    const { error } = await supabase.from('users').update(updates).eq('id', parentId)
    if (error) throw error
    result.wallet = walletRowToJson(await getParentWalletRow(parentId))
  }

  if (body.perfect_week_bonus !== undefined || body.grade_thresholds !== undefined) {
    await verifyStudentBelongsToParent(parentId, body.student_id)
    const updates = {}
    if (body.perfect_week_bonus !== undefined) updates.perfect_week_bonus = body.perfect_week_bonus
    if (body.grade_thresholds !== undefined) {
      updates.grade_reward_a_plus_cents = body.grade_thresholds.aPlusCents
      updates.grade_reward_a_cents = body.grade_thresholds.aCents
      updates.grade_reward_b_cents = body.grade_thresholds.bCents
      updates.grade_reward_c_cents = body.grade_thresholds.cCents
    }
    const { data, error } = await supabase
      .from('parent_student')
      .update(updates)
      .eq('parent_id', parentId)
      .eq('student_id', body.student_id)
      .select()
      .single()
    if (error) throw error
    result.studentSettings = {
      studentId: body.student_id,
      perfectWeekBonus: Number(data.perfect_week_bonus),
      gradeRewardAPlusCents: data.grade_reward_a_plus_cents,
      gradeRewardACents: data.grade_reward_a_cents,
      gradeRewardBCents: data.grade_reward_b_cents,
      gradeRewardCCents: data.grade_reward_c_cents,
    }
  }

  return result
}

export default createParentHandler({ method: 'POST', validate, handle })
