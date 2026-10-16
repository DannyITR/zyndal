import { createStudentHandler } from '../_lib/studentHandler.js'
import { supabase } from '../_lib/auth.js'
import { SUBJECTS, LIGHT_ELECTIVE_SUBJECTS } from '../../src/lib/questions.js'
import { resolveClassSubject } from '../_lib/classSubject.js'
import { getStudentCourses } from '../_lib/studentCourses.js'
import { getClassLeaves } from '../_lib/classLeaves.js'

// Every subject this endpoint knows how to surface a group/claimed-class
// entry for — SUBJECTS alone would silently drop a lighter elective's
// group entirely (see school_electives / LIGHT_ELECTIVE_SUBJECTS' own
// comment), since a subject not in this list never gets checked below.
const ALL_LISTABLE_SUBJECTS = [...SUBJECTS, ...LIGHT_ELECTIVE_SUBJECTS]

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
// here by its own subject (resolveClassSubject — classes.subject, set at
// teacher-claim approval time, or a name-keyword fallback for a legacy
// class with none) rather than by matching classes.group_id against this
// grade's groups, so it still shows up even if its group is a different
// grade than the student's current profile grade. api/classes/get-student-
// classes.js (My Classes) uses the exact same helper, so a class resolves
// to the same subject regardless of which screen reaches it.
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
    .select('id, subject, created_at')
    .eq('school_id', user.school_id)
    .eq('grade', user.grade)
  if (groupsError) throw groupsError

  // Courses added from another grade (student_courses — see
  // api/student/add-course.js): each gets its own group entry, at that
  // grade, right after the student's own entries for the same subject.
  const courses = await getStudentCourses(userId, user.grade)
  const courseGroupsBySubject = {}
  if (courses.length > 0) {
    const { data: courseGroups, error: courseGroupsError } = await supabase
      .from('school_subject_groups')
      .select('id, subject, grade, created_at')
      .eq('school_id', user.school_id)
      .in('grade', [...new Set(courses.map((c) => c.grade))])
    if (courseGroupsError) throw courseGroupsError
    for (const c of courses) {
      const group = (courseGroups || []).find((g) => g.subject === c.subject && Number(g.grade) === Number(c.grade))
      if (group) (courseGroupsBySubject[c.subject] ||= []).push(group)
    }
  }

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

  // Core classes the student left (class_leaves — see api/_lib/classLeaves.js)
  // still get an entry, flagged left and not joined, so the grid can show
  // them under Electives with a Join button. A left teacher's class has no
  // class_students row any more, so it's loaded from the leave instead.
  const leaves = await getClassLeaves(userId)
  const leftGroupIds = new Set(leaves.filter((l) => l.class_type === 'group').map((l) => l.class_id))
  const leftClassIds = leaves.filter((l) => l.class_type === 'class' && !myClassIds.includes(l.class_id)).map((l) => l.class_id)
  const classIdsToShow = [...myClassIds, ...leftClassIds]

  if (classIdsToShow.length > 0) {
    const { data: myClasses, error: classesError } = await supabase
      .from('classes')
      .select('id, name, grade, course_number, subject, current_unit_number, current_unit_title, created_at')
      .in('id', classIdsToShow)
    if (classesError) throw classesError
    for (const c of myClasses || []) {
      const subjectId = resolveClassSubject(c)
      if (!subjectId) continue
      if (!classEntriesBySubject[subjectId]) classEntriesBySubject[subjectId] = []
      classEntriesBySubject[subjectId].push({
        kind: 'class',
        id: c.id,
        subject: subjectId,
        // The class's own grade, not the student's — a Gr 10 class joined
        // for an added course shows and behaves as Gr 10.
        grade: c.grade ?? user.grade,
        name: c.name,
        courseNumber: c.course_number,
        currentUnitNumber: c.current_unit_number ?? 1,
        currentUnitTitle: c.current_unit_title || null,
        classCreatedAt: c.created_at,
        joined: !leftClassIds.includes(c.id),
        left: leftClassIds.includes(c.id),
      })
    }
  }

  // Fixed subject order (core, then full electives, then light electives —
  // ALL_LISTABLE_SUBJECTS' own order), each subject's own claimed-class
  // entries listed right before its group entry — matches the seed data
  // (every school gets the 5 core subjects x grades 7-11; a school's own
  // electives, if any, come from school_electives/school_subject_groups
  // instead), so a subject's group entry only comes back missing if it
  // isn't actually offered at this school+grade at all.
  const entries = []
  for (const s of ALL_LISTABLE_SUBJECTS) {
    for (const classEntry of classEntriesBySubject[s.id] || []) entries.push(classEntry)
    const group = groupBySubject[s.id]
    if (group) {
      entries.push({
        kind: 'group',
        id: group.id,
        subject: s.id,
        grade: user.grade,
        joined: joinedGroupIds.has(group.id),
        left: leftGroupIds.has(group.id),
        groupCreatedAt: group.created_at,
      })
    }
    for (const courseGroup of courseGroupsBySubject[s.id] || []) {
      entries.push({
        kind: 'group',
        id: courseGroup.id,
        subject: s.id,
        grade: courseGroup.grade,
        // Added from another grade — the card offers Remove instead of
        // Leave (see ClassCard.jsx / api/student/remove-course.js).
        addedCourse: true,
        joined: joinedGroupIds.has(courseGroup.id),
        groupCreatedAt: courseGroup.created_at,
      })
    }
  }

  return {
    schoolId: user.school_id,
    schoolName: school?.name ?? null,
    grade: user.grade,
    entries,
  }
}

export default createStudentHandler({ method: 'GET', handle })
