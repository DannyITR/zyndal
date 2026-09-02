import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { SUBJECTS } from '../../src/lib/questions.js'

// One entry per actual class the student can see on the home screen's "My
// Subjects" grid: one 'group' entry per (school, subject, grade) — the
// open, unclaimed group, joined or not — plus one 'class' entry per
// teacher-claimed class this student has actually joined. These are
// deliberately flat, separate entries (not nested) — a group and a claimed
// class are different memberships (school_subject_group_students vs
// class_students) with their own separate Class Card and forum; a subject
// can have zero, one, or several claimed-class entries alongside its one
// group entry, and each renders as its own tile.
//
// Bug fix (kept from the earlier nested version): a joined class surfaces
// here by its own subject (classes.subject, set at teacher-claim approval
// time — see api/admin/resolve-teacher-claim.js) rather than by matching
// classes.group_id against this grade's groups, so it still shows up even
// if its group is a different grade than the student's current profile
// grade, or if it's a legacy class from the older join-by-teacher-code flow
// (api/teacher/create-class.js) that never captured group_id/subject at
// all — those fall back to a name-keyword match against the 6 canonical
// subjects, the only signal they carry.
async function handle({ userId }) {
  const { data: user, error: userError } = await supabase.from('users').select('school_id, grade').eq('id', userId).maybeSingle()
  if (userError) throw userError
  if (!user?.school_id || !user?.grade) {
    return { schoolId: user?.school_id ?? null, schoolName: null, grade: user?.grade ?? null, entries: [] }
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

  const classEntriesBySubject = {}
  const { data: myClassRows, error: myClassesError } = await supabase.from('class_students').select('class_id').eq('student_id', userId)
  if (myClassesError) throw myClassesError
  const myClassIds = (myClassRows || []).map((c) => c.class_id)

  if (myClassIds.length > 0) {
    const { data: myClasses, error: classesError } = await supabase.from('classes').select('id, name, course_number, subject').in('id', myClassIds)
    if (classesError) throw classesError
    for (const c of myClasses || []) {
      const subjectId = c.subject || SUBJECTS.find((s) => c.name.toLowerCase().includes(s.name.toLowerCase()))?.id
      if (!subjectId) continue
      if (!classEntriesBySubject[subjectId]) classEntriesBySubject[subjectId] = []
      classEntriesBySubject[subjectId].push({ kind: 'class', id: c.id, subject: subjectId, name: c.name, courseNumber: c.course_number })
    }
  }

  // Fixed SUBJECTS order, each subject's own claimed-class entries listed
  // right before its group entry — matches the seed data (every school gets
  // all 6 subjects x grades 7-11), so a subject's group entry only comes
  // back missing if the seed script hasn't been run for a given school yet.
  const entries = []
  for (const s of SUBJECTS) {
    for (const classEntry of classEntriesBySubject[s.id] || []) entries.push(classEntry)
    const group = groupBySubject[s.id]
    if (group) entries.push({ kind: 'group', id: group.id, subject: s.id, joined: joinedGroupIds.has(group.id) })
  }

  return {
    schoolId: user.school_id,
    schoolName: school?.name ?? null,
    grade: user.grade,
    entries,
  }
}

export default createStudentHandler({ method: 'GET', handle })
