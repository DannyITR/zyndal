import { createParentHandler } from '../_lib/parentHandler.js'
import { supabase } from '../_lib/auth.js'
import { verifyStudentBelongsToParent, getParentWalletRow, walletRowToJson } from '../_lib/parentDb.js'

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
  if (hasStudentField && (!body.student_id || typeof body.student_id !== 'string')) {
    return 'student_id is required when updating perfect_week_bonus or grade_thresholds.'
  }
  if (body.coin_rate !== undefined && (!Number.isFinite(body.coin_rate) || body.coin_rate <= 0)) {
    return 'coin_rate must be a positive number.'
  }
  if (body.perfect_week_bonus !== undefined && (!Number.isFinite(body.perfect_week_bonus) || body.perfect_week_bonus < 0)) {
    return 'perfect_week_bonus must be a non-negative number.'
  }
  if (body.grade_thresholds !== undefined) {
    const { aPlusCents, aCents, bCents, cCents } = body.grade_thresholds || {}
    if (![aPlusCents, aCents, bCents, cCents].every((v) => Number.isFinite(v) && v >= 0)) {
      return 'grade_thresholds must include non-negative aPlusCents, aCents, bCents, cCents.'
    }
  }
  if (body.milestone_settings !== undefined && (typeof body.milestone_settings !== 'object' || body.milestone_settings === null)) {
    return 'milestone_settings must be an object.'
  }
  if (
    body.coin_rate === undefined &&
    body.perfect_week_bonus === undefined &&
    body.grade_thresholds === undefined &&
    body.milestone_settings === undefined
  ) {
    return 'Provide at least one setting to update.'
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
