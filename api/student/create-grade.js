import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getLinkedParents } from '../_lib/db.js'
import { assertPremium } from '../_lib/subscription.js'
import { computeSuggestedBonusCents } from '../../src/lib/gradeReward.js'
import { sanitizeSubject, sanitizeString, sanitizeInteger } from '../_lib/sanitize.js'
import { insertNotification } from '../_lib/notifications.js'
import { notificationText } from '../_lib/notificationText.js'
import { sendPushToUser } from '../_lib/push.js'
import { centsToDisplay } from '../../src/lib/money.js'

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

// Loops over every linked parent (up to 2) — see save-upload.js's
// identical treatment for the full rationale (each parent's own reward
// settings, own row, own notification, safe under the widened
// grade_bonuses_grade_id_parent_id_key constraint).
async function maybeCreateGradeBonus({ userId, gradePercentage, gradeId }) {
  const linkedParents = await getLinkedParents(userId)
  if (linkedParents.length === 0) return

  const { data: student } = await supabase.from('users').select('username').eq('id', userId).maybeSingle()
  const studentUsername = student?.username || 'Someone'

  for (const parent of linkedParents) {
    const suggestedBonusCents = computeSuggestedBonusCents(gradePercentage, {
      gradeRewardAPlusCents: parent.gradeRewardAPlusCents,
      gradeRewardACents: parent.gradeRewardACents,
      gradeRewardBCents: parent.gradeRewardBCents,
      gradeRewardCCents: parent.gradeRewardCCents,
    })
    if (suggestedBonusCents <= 0) continue

    const { error } = await supabase.from('grade_bonuses').insert({
      grade_id: gradeId,
      student_id: userId,
      parent_id: parent.parentId,
      grade_received: gradePercentage,
      suggested_bonus_cents: suggestedBonusCents,
    })
    if (error) {
      if (error.code === '23505') continue // already recorded for this grade+parent
      throw error
    }

    const amount = centsToDisplay(suggestedBonusCents)
    const { title, body: notifBody } = notificationText('grade_bonus_ready', parent.languagePreference, { studentUsername, amount })
    await insertNotification({ userId: parent.parentId, type: 'grade_bonus_ready', title, body: notifBody, data: { student_id: userId, grade_id: gradeId } })
    await sendPushToUser({ userId: parent.parentId, type: 'grade_bonus_ready', title, body: notifBody, url: 'https://zyndal.ca' })
  }
}

async function handle({ userId, body }) {
  await assertPremium(userId)
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
