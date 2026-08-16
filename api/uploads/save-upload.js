import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getLinkedParents } from '../_lib/db.js'
import { assertPremium } from '../_lib/subscription.js'
import { assertUploadPagesAllowed } from '../_lib/uploadLimits.js'
import { computeSuggestedBonusCents } from '../../src/lib/gradeReward.js'
import { sanitizeSubject, sanitizeString, sanitizeInteger } from '../_lib/sanitize.js'
import { insertNotification } from '../_lib/notifications.js'
import { notificationText } from '../_lib/notificationText.js'
import { sendPushToUser } from '../_lib/push.js'
import { centsToDisplay } from '../../src/lib/money.js'

// Mirrors createUpload in storage.js, PLUS two things the literal spec
// omits but "keep existing functionality intact" requires: the `notes`
// field (shown on UploadDetailScreen as "Your notes: ...", silently
// dropped if not saved here) and the grade-bonus side effect that
// storage.js's saveUpload() (the actual client-facing function) triggers
// right after via maybeCreateGradeBonusForSource — without it, uploading a
// graded test would silently stop ever suggesting a payout bonus to the
// parent.
function validate(body) {
  const subject = sanitizeSubject(body.subject)
  if (!subject) return { field: 'subject', message: 'subject must be one of Math, Science, History, Geography, English, French.' }
  body.subject = subject

  const topic = sanitizeString(body.topic, 100)
  if (!topic) return { field: 'topic', message: 'topic is required and must be 1-100 characters.' }
  body.topic = topic

  if (!body.document_type || typeof body.document_type !== 'string') {
    return { field: 'document_type', message: 'document_type is required.' }
  }

  if (body.grade_received !== undefined && body.grade_received !== null) {
    const gradeReceived = sanitizeInteger(body.grade_received, 0, 100)
    if (gradeReceived === null) {
      return { field: 'grade_received', message: 'grade_received must be a whole number between 0 and 100.' }
    }
    body.grade_received = gradeReceived
  }

  if (body.notes !== undefined && body.notes !== null && body.notes !== '') {
    body.notes = sanitizeString(body.notes, 500)
  }

  return null
}

// Loops over every linked parent (up to 2) — each gets their own
// suggested-bonus row (computed from THEIR OWN reward-cents settings,
// which can differ per parent) and their own notification, safe under
// the grade_bonuses_upload_id_parent_id_key constraint (widened to
// include parent_id specifically so this no longer collides).
async function maybeCreateGradeBonus({ userId, gradePercentage, uploadId }) {
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
      upload_id: uploadId,
      student_id: userId,
      parent_id: parent.parentId,
      grade_received: gradePercentage,
      suggested_bonus_cents: suggestedBonusCents,
    })
    if (error) {
      if (error.code === '23505') continue // already recorded for this upload+parent
      throw error
    }

    const amount = centsToDisplay(suggestedBonusCents)
    const { title, body: notifBody } = notificationText('grade_bonus_ready', parent.languagePreference, { studentUsername, amount })
    await insertNotification({ userId: parent.parentId, type: 'grade_bonus_ready', title, body: notifBody, data: { student_id: userId, upload_id: uploadId } })
    await sendPushToUser({ userId: parent.parentId, type: 'grade_bonus_ready', title, body: notifBody, url: 'https://zyndal.ca' })
  }
}

async function handle({ userId, body }) {
  await assertPremium(userId)
  const { subject, topic, grade_received: gradeReceived, test_date: testDate, summary, key_concepts: keyConcepts, document_type: documentType, pages_count: pagesCount, notes, timezone } = body
  const newPages = pagesCount ?? 1

  // Soft weekly cap, checked (and recorded) before the insert — a rejected
  // upload here means nothing gets persisted at all, matching "block
  // further uploads for that subject" rather than saving a partial row.
  await assertUploadPagesAllowed({ userId, subject, timezone, newPages })

  const { data, error } = await supabase
    .from('uploads')
    .insert({
      user_id: userId,
      document_type: documentType,
      subject,
      topic,
      grade_received: gradeReceived ?? null,
      test_date: testDate ?? null,
      notes: notes ?? null,
      summary: summary ?? null,
      key_concepts: keyConcepts ?? null,
      pages_count: newPages,
    })
    .select()
    .single()
  if (error) throw error

  if (documentType === 'test' && gradeReceived != null) {
    await maybeCreateGradeBonus({ userId, gradePercentage: gradeReceived, uploadId: data.id })
  }

  return data
}

export default createStudentHandler({ method: 'POST', validate, handle })
