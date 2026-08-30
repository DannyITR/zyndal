import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { SUBJECTS } from '../../src/lib/questions.js'

// The 6 unclaimed (school, subject, grade) groups for the logged-in
// student's own school+grade — read server-side from their user row, never
// trusted from the client, matching every other student-scoped endpoint's
// convention. claimedClasses is always [] for now (Phase 1 — no teacher
// claims exist yet) but shaped this way so Phase 2 only needs to populate
// it, not change this response shape.
async function handle({ userId }) {
  const { data: user, error: userError } = await supabase.from('users').select('school_id, grade').eq('id', userId).maybeSingle()
  if (userError) throw userError
  if (!user?.school_id || !user?.grade) return { schoolId: user?.school_id ?? null, schoolName: null, groups: [] }

  const { data: school, error: schoolError } = await supabase.from('schools').select('name').eq('id', user.school_id).maybeSingle()
  if (schoolError) throw schoolError

  const { data: groups, error: groupsError } = await supabase
    .from('school_subject_groups')
    .select('id, subject')
    .eq('school_id', user.school_id)
    .eq('grade', user.grade)
  if (groupsError) throw groupsError

  const { data: memberships, error: membershipsError } = await supabase
    .from('school_subject_group_students')
    .select('group_id')
    .eq('student_id', userId)
  if (membershipsError) throw membershipsError
  const joinedGroupIds = new Set((memberships || []).map((m) => m.group_id))

  const groupBySubject = Object.fromEntries((groups || []).map((g) => [g.subject, g]))

  return {
    schoolId: user.school_id,
    schoolName: school?.name ?? null,
    grade: user.grade,
    // Always all 6 SUBJECTS, in that fixed order — matches the seed data
    // (every school gets all 6 subjects x grades 7-11), so this only comes
    // back short if the seed script hasn't been run for a given school yet.
    groups: SUBJECTS.map((s) => {
      const group = groupBySubject[s.id]
      return group
        ? { id: group.id, subject: s.id, joined: joinedGroupIds.has(group.id), claimedClasses: [] }
        : null
    }).filter(Boolean),
  }
}

export default createStudentHandler({ method: 'GET', handle })
