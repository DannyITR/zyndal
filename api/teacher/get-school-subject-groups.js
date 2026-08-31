import { createTeacherHandler } from '../_lib/teacherHandler.js'
import { supabase } from '../_lib/auth.js'
import { sanitizeUuid, sanitizeGrade } from '../_lib/sanitize.js'
import { SUBJECTS } from '../../src/lib/questions.js'

// Unlike the student version of this endpoint, a teacher isn't tied to one
// school/grade — school_id/grade are teacher-chosen query params here, not
// derived from their own profile.
function validate(body) {
  const schoolId = sanitizeUuid(body.school_id)
  if (!schoolId) return { field: 'school_id', message: 'school_id must be a valid school id.' }
  body.school_id = schoolId

  const grade = sanitizeGrade(body.grade)
  if (!grade) return { field: 'grade', message: 'grade must be between 7 and 11.' }
  body.grade = grade

  return null
}

async function handle({ teacherId, body }) {
  const { school_id: schoolId, grade } = body

  const { data: groups, error: groupsError } = await supabase
    .from('school_subject_groups')
    .select('id, subject')
    .eq('school_id', schoolId)
    .eq('grade', grade)
  if (groupsError) throw groupsError

  const groupIds = (groups || []).map((g) => g.id)
  let claimsByGroup = {}
  if (groupIds.length > 0) {
    // Most-recent-first so "the current status" for a group with more than
    // one past claim (e.g. rejected, then resubmitted) is the latest one.
    const { data: claims, error: claimsError } = await supabase
      .from('teacher_claims')
      .select('group_id, status, rejection_reason, created_at')
      .eq('teacher_id', teacherId)
      .in('group_id', groupIds)
      .order('created_at', { ascending: false })
    if (claimsError) throw claimsError
    for (const claim of claims || []) {
      if (!claimsByGroup[claim.group_id]) claimsByGroup[claim.group_id] = claim
    }
  }

  const groupBySubject = Object.fromEntries((groups || []).map((g) => [g.subject, g]))

  return {
    // Always all 6 SUBJECTS in fixed order, matching the seed data — see
    // api/student/get-school-subject-groups.js's identical comment.
    groups: SUBJECTS.map((s) => {
      const group = groupBySubject[s.id]
      if (!group) return null
      const claim = claimsByGroup[group.id]
      return {
        id: group.id,
        subject: s.id,
        myClaimStatus: claim?.status ?? null,
        rejectionReason: claim?.status === 'rejected' ? claim.rejection_reason : null,
      }
    }).filter(Boolean),
  }
}

export default createTeacherHandler({ method: 'GET', validate, handle })
