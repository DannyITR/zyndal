import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { getLinkedParent } from '../_lib/db.js'
import { assertPremium } from '../_lib/subscription.js'
import { computeSuggestedBonusCents } from '../../src/lib/gradeReward.js'
import { sanitizeSubject, sanitizeString, sanitizeInteger } from '../_lib/sanitize.js'

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

async function maybeCreateGradeBonus({ userId, gradePercentage, uploadId }) {
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
    upload_id: uploadId,
    student_id: userId,
    parent_id: linkedParent.parentId,
    grade_received: gradePercentage,
    suggested_bonus_cents: suggestedBonusCents,
  })
  if (error && error.code !== '23505') throw error // already recorded for this upload
}

async function handle({ userId, body }) {
  await assertPremium(userId)
  const { subject, topic, grade_received: gradeReceived, test_date: testDate, summary, key_concepts: keyConcepts, document_type: documentType, pages_count: pagesCount, notes } = body

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
      pages_count: pagesCount ?? 1,
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
