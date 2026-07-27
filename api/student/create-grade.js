import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getLinkedParent } from '../_lib/db.js'
import { computeSuggestedBonusCents } from '../../src/lib/gradeReward.js'
import { sanitizeSubject, sanitizeString, sanitizeInteger } from '../_lib/sanitize.js'

// Backs createGrade() in src/lib/storage.js. Mirrors save-upload.js's
// maybeCreateGradeBonus side effect exactly, but keyed by grade_id instead
// of upload_id (grade_bonuses.grade_id/upload_id are mutually exclusive —
// see supabase/schema.sql's grade_bonuses_source_check) — a manually-logged
// grade feeds the same parent payout-suggestion flow as an uploaded test.
function validate(body) {
  const subject = sanitizeSubject(body.subject)
  if (!subject) return { field: 'subject', message: 'subject must be one of Math, Science, History, Geography, English, French.' }
  body.subject = subject

  const testName = sanitizeString(body.test_name, 100)
  if (!testName) return { field: 'test_name', message: 'test_name is required and must be 1-100 characters.' }
  body.test_name = testName

  const gradePercentage = sanitizeInteger(body.grade_percentage, 0, 100)
  if (gradePercentage === null) {
    return { field: 'grade_percentage', message: 'grade_percentage must be a whole number between 0 and 100.' }
  }
  body.grade_percentage = gradePercentage

  if (!body.test_date || typeof body.test_date !== 'string') {
    return { field: 'test_date', message: 'test_date is required.' }
  }
  return null
}

async function maybeCreateGradeBonus({ userId, gradePercentage, gradeId }) {
  const linkedParent = await getLinkedParent(userId)
  if (!linkedParent) return

  const suggestedBonusCents = computeSuggestedBonusCents(gradePercentage, {
    gradeRewardAPlusCents: linkedParent.gradeRewardAPlusCents,
    gradeRewardACents: linkedParent.gradeRewardACents,
    gradeRewardBCents: linkedParent.gradeRewardBCents,
    gradeRewardCCents: linkedParent.gradeRewardCCents,
  })
  if (suggestedBonusCents <= 0) return

  const { error } = await supabase.from('grade_bonuses').insert({
    grade_id: gradeId,
    student_id: userId,
    parent_id: linkedParent.parentId,
    grade_received: gradePercentage,
    suggested_bonus_cents: suggestedBonusCents,
  })
  if (error && error.code !== '23505') throw error // already recorded for this grade
}

async function handle({ userId, body }) {
  const { subject, test_name: testName, grade_percentage: gradePercentage, test_date: testDate, notes } = body

  const { data, error } = await supabase
    .from('grades')
    .insert({ user_id: userId, subject, test_name: testName, grade_percentage: gradePercentage, test_date: testDate, notes: notes ?? null })
    .select()
    .single()
  if (error) throw error

  await maybeCreateGradeBonus({ userId, gradePercentage, gradeId: data.id })
  return data
}

export default createStudentHandler({ method: 'POST', validate, handle })
