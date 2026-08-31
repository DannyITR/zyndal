import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { SUBJECTS } from '../../src/lib/questions.js'

// The 6 (school, subject, grade) groups for the logged-in student's own
// school+grade — read server-side from their user row, never trusted from
// the client, matching every other student-scoped endpoint's convention.
// claimedClasses surfaces any of THIS student's own joined classes
// (class_students, the same existing join-by-code flow as any other class)
// that were born from one of these groups (classes.group_id) — joining the
// open group itself and joining a teacher's claimed class remain separate
// actions; this is purely "does the student already belong to one."
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
  const groupIds = (groups || []).map((g) => g.id)

  let claimedClassesByGroup = {}
  if (groupIds.length > 0) {
    const { data: myClassRows, error: myClassesError } = await supabase
      .from('class_students')
      .select('class_id')
      .eq('student_id', userId)
    if (myClassesError) throw myClassesError
    const myClassIds = (myClassRows || []).map((c) => c.class_id)

    if (myClassIds.length > 0) {
      const { data: claimedRows, error: claimedError } = await supabase
        .from('classes')
        .select('id, group_id, name, course_number')
        .in('id', myClassIds)
        .in('group_id', groupIds)
      if (claimedError) throw claimedError
      for (const c of claimedRows || []) {
        if (!claimedClassesByGroup[c.group_id]) claimedClassesByGroup[c.group_id] = []
        claimedClassesByGroup[c.group_id].push({ id: c.id, name: c.name, courseNumber: c.course_number })
      }
    }
  }

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
        ? {
            id: group.id,
            subject: s.id,
            joined: joinedGroupIds.has(group.id),
            claimedClasses: claimedClassesByGroup[group.id] || [],
          }
        : null
    }).filter(Boolean),
  }
}

export default createStudentHandler({ method: 'GET', handle })
