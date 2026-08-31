import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { SUBJECTS } from '../../src/lib/questions.js'

// The 6 (school, subject, grade) groups for the logged-in student's own
// school+grade — read server-side from their user row, never trusted from
// the client, matching every other student-scoped endpoint's convention.
// claimedClasses surfaces every class this student has ever joined
// (class_students) that resolves to one of the 6 canonical subjects —
// joining the open group itself and joining a teacher's claimed class remain
// separate actions; this is purely "does the student already belong to one."
//
// Bug fix: this used to only look up classes with classes.group_id in this
// student's CURRENT-grade groups, which missed two real cases: (1) a
// teacher-claimed class (api/admin/resolve-teacher-claim.js sets
// classes.subject/group_id at approval time) whose group is a DIFFERENT
// grade than the student's current profile grade — e.g. the student joined
// while in grade 10 and has since moved to grade 9 — and (2) a class from
// the older, still-active join-by-teacher-code flow
// (api/teacher/create-class.js), which predates the schools feature and
// never captures group_id or subject at all. Both cases showed correctly on
// the "My Classes" page (api/student/get-my-classes.js has no such
// filtering) but silently had no Class Card here. Fixed by keying off every
// joined class's own subject (falling back to a name-keyword match against
// the 6 canonical subjects for a legacy class with none) instead of
// filtering by this grade's group_id up front.
async function handle({ userId }) {
  const { data: user, error: userError } = await supabase.from('users').select('school_id, grade').eq('id', userId).maybeSingle()
  if (userError) throw userError
  if (!user?.school_id || !user?.grade) {
    return { schoolId: user?.school_id ?? null, schoolName: null, grade: user?.grade ?? null, groups: [] }
  }

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

  const claimedClassesBySubject = {}
  const { data: myClassRows, error: myClassesError } = await supabase.from('class_students').select('class_id').eq('student_id', userId)
  if (myClassesError) throw myClassesError
  const myClassIds = (myClassRows || []).map((c) => c.class_id)

  if (myClassIds.length > 0) {
    const { data: myClasses, error: classesError } = await supabase.from('classes').select('id, name, course_number, subject').in('id', myClassIds)
    if (classesError) throw classesError
    for (const c of myClasses || []) {
      const subjectId = c.subject || SUBJECTS.find((s) => c.name.toLowerCase().includes(s.name.toLowerCase()))?.id
      if (!subjectId) continue
      if (!claimedClassesBySubject[subjectId]) claimedClassesBySubject[subjectId] = []
      claimedClassesBySubject[subjectId].push({ id: c.id, name: c.name, courseNumber: c.course_number })
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
            claimedClasses: claimedClassesBySubject[s.id] || [],
          }
        : null
    }).filter(Boolean),
  }
}

export default createStudentHandler({ method: 'GET', handle })
